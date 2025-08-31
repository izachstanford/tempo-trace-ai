import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  // How many items to fetch per category per year
  ITEMS_PER_CATEGORY: 20,
  // Rate limiting delay between API calls (ms)
  API_DELAY: 150,
  // Maximum retries for failed requests
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

async function searchTrack(trackName, artistName, token) {
  const query = artistName ? `${trackName} artist:${artistName}` : trackName;
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'track');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  return json?.tracks?.items?.[0] || null;
}

async function searchAlbum(albumName, artistName, token) {
  const query = artistName ? `${albumName} artist:${artistName}` : albumName;
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'album');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  return json?.albums?.items?.[0] || null;
}

async function getTrackByUri(uri, token) {
  if (!uri || !uri.startsWith('spotify:track:')) return null;
  
  const trackId = uri.replace('spotify:track:', '');
  const url = `https://api.spotify.com/v1/tracks/${trackId}`;
  
  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  return response.ok ? json : null;
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
        spotifyUrl: artistData?.external_urls?.spotify || null
      });
    } catch (error) {
      console.error(`❌ Error fetching data for artist "${artistName}":`, error.message);
      enriched.push({
        name: artistName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

async function enrichTracks(tracks, token, trackUriMap = {}) {
  const enriched = [];
  
  for (const [trackName, playCount] of tracks) {
    console.log(`🎵 Fetching data for track: ${trackName}`);
    try {
      let trackData = null;
      
      // First, try to find the track by URI if available
      const trackUri = trackUriMap[trackName];
      if (trackUri) {
        trackData = await getTrackByUri(trackUri, token);
      }
      
      // If URI lookup failed or no URI available, fall back to search
      if (!trackData) {
        trackData = await searchTrack(trackName, '', token);
      }
      
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: trackData,
        image: trackData?.album?.images?.[0]?.url || null,
        spotifyUrl: trackData?.external_urls?.spotify || null,
        artist: trackData?.artists?.[0]?.name || null
      });
    } catch (error) {
      console.error(`❌ Error fetching data for track "${trackName}":`, error.message);
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null,
        artist: null
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

async function enrichAlbums(albums, token, albumUriMap = {}) {
  const enriched = [];
  
  for (const [albumName, playCount] of albums) {
    console.log(`💿 Fetching data for album: ${albumName}`);
    try {
      let albumData = null;
      
      // First, try to find the album by URI if available
      const albumUri = albumUriMap[albumName];
      if (albumUri) {
        albumData = await getAlbumByUri(albumUri, token);
      }
      
      // If URI lookup failed or no URI available, fall back to search
      if (!albumData) {
        albumData = await searchAlbum(albumName, '', token);
      }
      
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: albumData,
        image: albumData?.images?.[0]?.url || null,
        spotifyUrl: albumData?.external_urls?.spotify || null,
        artist: albumData?.artists?.[0]?.name || null
      });
    } catch (error) {
      console.error(`❌ Error fetching data for album "${albumName}":`, error.message);
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null,
        artist: null
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

async function getAlbumByUri(uri, token) {
  if (!uri || !uri.startsWith('spotify:album:')) return null;
  
  const albumId = uri.replace('spotify:album:', '');
  const url = `https://api.spotify.com/v1/albums/${albumId}`;
  
  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  return response.ok ? json : null;
}

function buildTrackUriMap(consolidatedData) {
  const trackUriMap = {};
  
  // Process consolidated data to build track name -> URI mapping
  if (consolidatedData && Array.isArray(consolidatedData)) {
    consolidatedData.forEach(record => {
      if (record.master_metadata_track_name && record.spotify_track_uri) {
        trackUriMap[record.master_metadata_track_name] = record.spotify_track_uri;
      }
    });
  }
  
  return trackUriMap;
}

function buildAlbumUriMap(consolidatedData) {
  const albumUriMap = {};
  
  // Process consolidated data to build album name -> URI mapping
  if (consolidatedData && Array.isArray(consolidatedData)) {
    consolidatedData.forEach(record => {
      if (record.master_metadata_album_album_name && record.spotify_track_uri) {
        // Extract album URI from track URI (this is a simplified approach)
        // In a real implementation, you'd need to fetch the track first to get the album URI
        albumUriMap[record.master_metadata_album_album_name] = record.spotify_track_uri;
      }
    });
  }
  
  return albumUriMap;
}

async function processYearlyData(annualData, token, trackUriMap, albumUriMap) {
  const yearlyEnriched = {};
  
  for (const [year, yearData] of Object.entries(annualData)) {
    console.log(`\n📅 Processing year: ${year}`);
    
    // Get top items for this year
    const topArtists = yearData.top_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const topTracks = yearData.top_tracks.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const topAlbums = yearData.top_albums.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    
    console.log(`  📊 Found ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums`);
    
    // Enrich the data
    const enrichedArtists = await enrichArtists(topArtists, token);
    const enrichedTracks = await enrichTracks(topTracks, token, trackUriMap);
    const enrichedAlbums = await enrichAlbums(topAlbums, token, albumUriMap);
    
    yearlyEnriched[year] = {
      artists: enrichedArtists,
      tracks: enrichedTracks,
      albums: enrichedAlbums,
      yearStats: yearData.year_stats
    };
    
    console.log(`  ✅ Completed year ${year}`);
  }
  
  return yearlyEnriched;
}

async function processLifetimeData(lifetimeData, token, trackUriMap, albumUriMap) {
  console.log(`\n🏆 Processing lifetime data`);
  
  // Get top items for lifetime
  const topArtists = lifetimeData.top_lists.top_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
  const topTracks = lifetimeData.top_lists.top_tracks.slice(0, CONFIG.ITEMS_PER_CATEGORY);
  const topAlbums = lifetimeData.top_lists.top_albums.slice(0, CONFIG.ITEMS_PER_CATEGORY);
  
  console.log(`  📊 Found ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums`);
  
  // Enrich the data
  const enrichedArtists = await enrichArtists(topArtists, token);
  const enrichedTracks = await enrichTracks(topTracks, token, trackUriMap);
  const enrichedAlbums = await enrichAlbums(topAlbums, token, albumUriMap);
  
  return {
    artists: enrichedArtists,
    tracks: enrichedTracks,
    albums: enrichedAlbums,
    lifetimeStats: lifetimeData
  };
}

(async () => {
  try {
    console.log('🎵 Starting Enhanced Spotify data enrichment...');
    
    const token = await getToken();
    console.log('✅ Got Spotify access token');
    
    // Read the data files
    const dataPath = path.join(process.cwd(), 'public/data');
    const lifetimeData = JSON.parse(fs.readFileSync(path.join(dataPath, 'lifetime_streaming_stats.json'), 'utf8'));
    const annualData = JSON.parse(fs.readFileSync(path.join(dataPath, 'annual_recaps.json'), 'utf8'));
    
    // Try to read consolidated data for URI mapping
    let consolidatedData = null;
    try {
      consolidatedData = JSON.parse(fs.readFileSync(path.join(dataPath, 'consolidated_full_streaming_data_clean.json'), 'utf8'));
      console.log('✅ Loaded consolidated data for URI mapping');
    } catch (error) {
      console.log('⚠️  Consolidated data not found, will use search-only approach');
    }
    
    // Build URI maps for better accuracy
    const trackUriMap = buildTrackUriMap(consolidatedData);
    const albumUriMap = buildAlbumUriMap(consolidatedData);
    
    console.log(`📋 Built URI maps: ${Object.keys(trackUriMap).length} tracks, ${Object.keys(albumUriMap).length} albums`);
    
    // Process yearly data
    const yearlyEnriched = await processYearlyData(annualData, token, trackUriMap, albumUriMap);
    
    // Process lifetime data
    const lifetimeEnriched = await processLifetimeData(lifetimeData, token, trackUriMap, albumUriMap);
    
    // Create the comprehensive enriched data object
    const enrichedData = {
      lifetime: lifetimeEnriched,
      yearly: yearlyEnriched,
      lastUpdated: new Date().toISOString(),
      config: {
        itemsPerCategory: CONFIG.ITEMS_PER_CATEGORY,
        apiDelay: CONFIG.API_DELAY
      }
    };
    
    // Save to public directory
    const outputPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2));
    
    console.log('\n✅ Enhanced Spotify data enrichment completed!');
    console.log(`📈 Successfully enriched data for ${Object.keys(yearlyEnriched).length} years + lifetime`);
    console.log(`💾 Saved to: ${outputPath}`);
    
    // Print summary
    const totalArtists = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.artists.length, 0) + lifetimeEnriched.artists.length;
    const totalTracks = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.tracks.length, 0) + lifetimeEnriched.tracks.length;
    const totalAlbums = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.albums.length, 0) + lifetimeEnriched.albums.length;
    
    console.log(`📊 Total enriched: ${totalArtists} artists, ${totalTracks} tracks, ${totalAlbums} albums`);
    
  } catch (error) {
    console.error('❌ Error enriching Spotify data:', error.message);
    process.exit(1);
  }
})();
