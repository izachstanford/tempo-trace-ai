import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  ITEMS_PER_CATEGORY: 10, // Just top 10 for Pulse tab
  API_DELAY: 100,
  MAX_RETRIES: 3
};

async function getToken() {
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json));
  return json.access_token;
}

async function searchArtist(name, token) {
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', name);
  url.searchParams.set('type', 'artist');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  return json?.artists?.items?.[0] || null;
}

async function searchTrackWithArtist(trackName, artistName, token) {
  const query = `${trackName} artist:${artistName}`;
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'track');
  url.searchParams.set('limit', '3'); // Get a few results to choose from

  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  
  if (json?.tracks?.items?.length > 0) {
    // Find the best match
    const bestMatch = json.tracks.items.find(track => 
      track.artists.some(artist => 
        artist.name.toLowerCase().includes(artistName.toLowerCase()) ||
        artistName.toLowerCase().includes(artist.name.toLowerCase())
      )
    ) || json.tracks.items[0];
    
    return bestMatch;
  }
  
  return null;
}

async function searchAlbumWithArtist(albumName, artistName, token) {
  const query = `${albumName} artist:${artistName}`;
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'album');
  url.searchParams.set('limit', '3'); // Get a few results to choose from

  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  
  if (json?.albums?.items?.length > 0) {
    // Find the best match
    const bestMatch = json.albums.items.find(album => 
      album.artists.some(artist => 
        artist.name.toLowerCase().includes(artistName.toLowerCase()) ||
        artistName.toLowerCase().includes(artist.name.toLowerCase())
      )
    ) || json.albums.items[0];
    
    return bestMatch;
  }
  
  return null;
}

function buildArtistContextMap(consolidatedData) {
  console.log('🔗 Building artist context map from raw streaming data...');
  
  const trackArtistMap = new Map(); // track name -> artist name
  const albumArtistMap = new Map(); // album name -> artist name
  
  if (!consolidatedData || !Array.isArray(consolidatedData)) {
    console.log('⚠️  No consolidated data found, will use search-only approach');
    return { trackArtistMap, albumArtistMap };
  }
  
  let processedCount = 0;
  let trackCount = 0;
  let albumCount = 0;
  
  consolidatedData.forEach(record => {
    processedCount++;
    
    // Track -> Artist mapping
    if (record.master_metadata_track_name && record.master_metadata_album_artist_name) {
      const trackName = record.master_metadata_track_name;
      const artistName = record.master_metadata_album_artist_name;
      
      // Store the most common artist for each track
      if (!trackArtistMap.has(trackName)) {
        trackArtistMap.set(trackName, artistName);
        trackCount++;
      }
    }
    
    // Album -> Artist mapping
    if (record.master_metadata_album_album_name && record.master_metadata_album_artist_name) {
      const albumName = record.master_metadata_album_album_name;
      const artistName = record.master_metadata_album_artist_name;
      
      // Store the most common artist for each album
      if (!albumArtistMap.has(albumName)) {
        albumArtistMap.set(albumName, artistName);
        albumCount++;
      }
    }
  });
  
  console.log(`📊 Processed ${processedCount} records`);
  console.log(`🎵 Track -> Artist map: ${trackCount} entries`);
  console.log(`💿 Album -> Artist map: ${albumCount} entries`);
  
  return { trackArtistMap, albumArtistMap };
}

async function enrichArtists(artists, token) {
  const enriched = [];
  
  for (const [artistName, playCount] of artists) {
    console.log(`🎤 Fetching data for artist: ${artistName}`);
    try {
      const artistData = await searchArtist(artistName, token);
      enriched.push({
        name: artistName,
        plays: playCount,
        spotifyData: artistData,
        image: artistData?.images?.[0]?.url || null,
        spotifyUrl: artistData?.external_urls?.spotify || null,
        artist: artistName // Always show artist name for consistency
      });
    } catch (error) {
      console.error(`❌ Error fetching data for artist "${artistName}":`, error.message);
      enriched.push({
        name: artistName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null,
        artist: artistName
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

async function enrichTracksWithContext(tracks, trackArtistMap, token) {
  const enriched = [];
  
  for (const [trackName, playCount] of tracks) {
    console.log(`🎵 Fetching data for track: ${trackName}`);
    try {
      let trackData = null;
      let matchSource = 'none';
      
      // Get artist context from raw data
      const artistName = trackArtistMap.get(trackName);
      if (artistName) {
        trackData = await searchTrackWithArtist(trackName, artistName, token);
        if (trackData) {
          matchSource = 'context';
          console.log(`  ✅ Found via context: ${trackData.name} by ${trackData.artists[0]?.name}`);
        }
      }
      
      if (!trackData) {
        console.log(`  ⚠️  No artist context found for "${trackName}", skipping`);
      }
      
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: trackData,
        image: trackData?.album?.images?.[0]?.url || null,
        spotifyUrl: trackData?.external_urls?.spotify || null,
        artist: trackData?.artists?.[0]?.name || artistName || null,
        matchSource: matchSource
      });
    } catch (error) {
      console.error(`❌ Error fetching data for track "${trackName}":`, error.message);
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null,
        artist: trackArtistMap.get(trackName) || null,
        matchSource: 'error'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

async function enrichAlbumsWithContext(albums, albumArtistMap, token) {
  const enriched = [];
  
  for (const [albumName, playCount] of albums) {
    console.log(`💿 Fetching data for album: ${albumName}`);
    try {
      let albumData = null;
      let matchSource = 'none';
      
      // Get artist context from raw data
      const artistName = albumArtistMap.get(albumName);
      if (artistName) {
        albumData = await searchAlbumWithArtist(albumName, artistName, token);
        if (albumData) {
          matchSource = 'context';
          console.log(`  ✅ Found via context: ${albumData.name} by ${albumData.artists[0]?.name}`);
        }
      }
      
      if (!albumData) {
        console.log(`  ⚠️  No artist context found for "${albumName}", skipping`);
      }
      
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: albumData,
        image: albumData?.images?.[0]?.url || null,
        spotifyUrl: albumData?.external_urls?.spotify || null,
        artist: albumData?.artists?.[0]?.name || artistName || null,
        matchSource: matchSource
      });
    } catch (error) {
      console.error(`❌ Error fetching data for album "${albumName}":`, error.message);
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null,
        artist: albumArtistMap.get(albumName) || null,
        matchSource: 'error'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

(async () => {
  try {
    console.log('🎵 Starting Pulse tab Spotify data enrichment...');
    
    const token = await getToken();
    console.log('✅ Got Spotify access token');
    
    // Read the data files
    const dataPath = path.join(process.cwd(), 'public/data');
    const lifetimeData = JSON.parse(fs.readFileSync(path.join(dataPath, 'lifetime_streaming_stats.json'), 'utf8'));
    
    // Try to read consolidated data for artist context
    let consolidatedData = null;
    try {
      consolidatedData = JSON.parse(fs.readFileSync(path.join(dataPath, 'consolidated_full_streaming_data_clean.json'), 'utf8'));
      console.log('✅ Loaded consolidated data for artist context mapping');
    } catch (error) {
      console.log('⚠️  Consolidated data not found, will use search-only approach');
    }
    
    // Build artist context maps
    const { trackArtistMap, albumArtistMap } = buildArtistContextMap(consolidatedData);
    
    // Get top items for lifetime (Pulse tab)
    const topArtists = lifetimeData.top_lists.top_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const topTracks = lifetimeData.top_lists.top_tracks.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const topAlbums = lifetimeData.top_lists.top_albums.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    
    console.log(`\n🏆 Processing Pulse tab data (top ${CONFIG.ITEMS_PER_CATEGORY} each)`);
    console.log(`  📊 Found ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums`);
    
    // Enrich the data
    const enrichedArtists = await enrichArtists(topArtists, token);
    const enrichedTracks = await enrichTracksWithContext(topTracks, trackArtistMap, token);
    const enrichedAlbums = await enrichAlbumsWithContext(topAlbums, albumArtistMap, token);
    
    // Create the enriched data object (Pulse tab format)
    const enrichedData = {
      artists: enrichedArtists,
      tracks: enrichedTracks,
      albums: enrichedAlbums,
      lastUpdated: new Date().toISOString(),
      config: {
        itemsPerCategory: CONFIG.ITEMS_PER_CATEGORY,
        apiDelay: CONFIG.API_DELAY,
        contextBasedMatching: true,
        trackContextCount: trackArtistMap.size,
        albumContextCount: albumArtistMap.size
      }
    };
    
    // Save to public directory
    const outputPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2));
    
    console.log('\n✅ Pulse tab Spotify data enrichment completed!');
    console.log(`💾 Saved to: ${outputPath}`);
    
    // Print summary with match statistics
    const contextMatches = enrichedTracks.filter(t => t.matchSource === 'context').length + 
                          enrichedAlbums.filter(a => a.matchSource === 'context').length;
    const totalItems = enrichedTracks.length + enrichedAlbums.length;
    
    console.log(`📊 Total enriched: ${enrichedArtists.length} artists, ${enrichedTracks.length} tracks, ${enrichedAlbums.length} albums`);
    console.log(`🎯 Context-based matches: ${contextMatches} items`);
    console.log(`📈 Match rate: ${Math.round((contextMatches / totalItems) * 100)}%`);
    
  } catch (error) {
    console.error('❌ Error enriching Spotify data:', error.message);
    process.exit(1);
  }
})();
