import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  ITEMS_PER_CATEGORY: 20,
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

async function getTrackByUri(uri, token) {
  if (!uri || !uri.startsWith('spotify:track:')) return null;
  
  const trackId = uri.replace('spotify:track:', '');
  const url = `https://api.spotify.com/v1/tracks/${trackId}`;
  
  try {
    const response = await fetch(url, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    const json = await response.json();
    return response.ok ? json : null;
  } catch (error) {
    console.error(`Error fetching track ${uri}:`, error.message);
    return null;
  }
}

async function getAlbumByUri(uri, token) {
  if (!uri || !uri.startsWith('spotify:album:')) return null;
  
  const albumId = uri.replace('spotify:album:', '');
  const url = `https://api.spotify.com/v1/albums/${albumId}`;
  
  try {
    const response = await fetch(url, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    const json = await response.json();
    return response.ok ? json : null;
  } catch (error) {
    console.error(`Error fetching album ${uri}:`, error.message);
    return null;
  }
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

function buildUriMaps(consolidatedData) {
  console.log('🔗 Building URI maps from raw streaming data...');
  
  const trackUriMap = new Map(); // track name -> { uri, artist, album }
  const albumUriMap = new Map(); // album name -> { uri, artist }
  
  if (!consolidatedData || !Array.isArray(consolidatedData)) {
    console.log('⚠️  No consolidated data found, will use search-only approach');
    return { trackUriMap, albumUriMap };
  }
  
  let processedCount = 0;
  let uriCount = 0;
  
  consolidatedData.forEach(record => {
    processedCount++;
    
    // Track URI mapping
    if (record.master_metadata_track_name && record.spotify_track_uri) {
      const trackName = record.master_metadata_track_name;
      const trackUri = record.spotify_track_uri;
      const artistName = record.master_metadata_album_artist_name;
      const albumName = record.master_metadata_album_album_name;
      
      // Store the most recent URI for each track (they should be consistent)
      trackUriMap.set(trackName, {
        uri: trackUri,
        artist: artistName,
        album: albumName
      });
      uriCount++;
    }
    
    // Album URI mapping (extract from track URI)
    if (record.master_metadata_album_album_name && record.spotify_track_uri) {
      const albumName = record.master_metadata_album_album_name;
      const artistName = record.master_metadata_album_artist_name;
      
      // We'll get the album URI from the track data later
      if (!albumUriMap.has(albumName)) {
        albumUriMap.set(albumName, {
          artist: artistName,
          trackUri: record.spotify_track_uri // We'll use this to get album URI
        });
      }
    }
  });
  
  console.log(`📊 Processed ${processedCount} records, found ${uriCount} track URIs`);
  console.log(`🎵 Track URI map: ${trackUriMap.size} entries`);
  console.log(`💿 Album URI map: ${albumUriMap.size} entries`);
  
  return { trackUriMap, albumUriMap };
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

async function enrichTracksWithUris(tracks, trackUriMap, token) {
  const enriched = [];
  
  for (const [trackName, playCount] of tracks) {
    console.log(`🎵 Fetching data for track: ${trackName}`);
    try {
      let trackData = null;
      let matchSource = 'none';
      
      // Try URI-based lookup first
      const uriInfo = trackUriMap.get(trackName);
      if (uriInfo && uriInfo.uri) {
        trackData = await getTrackByUri(uriInfo.uri, token);
        if (trackData) {
          matchSource = 'uri';
          console.log(`  ✅ Found via URI: ${trackData.name} by ${trackData.artists[0]?.name}`);
        }
      }
      
      // If URI lookup failed, we could fall back to search, but let's be strict
      if (!trackData) {
        console.log(`  ⚠️  No URI found for "${trackName}", skipping`);
      }
      
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: trackData,
        image: trackData?.album?.images?.[0]?.url || null,
        spotifyUrl: trackData?.external_urls?.spotify || null,
        artist: trackData?.artists?.[0]?.name || null,
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
        artist: null,
        matchSource: 'error'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

async function enrichAlbumsWithUris(albums, albumUriMap, trackUriMap, token) {
  const enriched = [];
  
  for (const [albumName, playCount] of albums) {
    console.log(`💿 Fetching data for album: ${albumName}`);
    try {
      let albumData = null;
      let matchSource = 'none';
      
      // Try to find album URI from track URIs
      const albumInfo = albumUriMap.get(albumName);
      if (albumInfo && albumInfo.trackUri) {
        // First get the track to extract album URI
        const trackData = await getTrackByUri(albumInfo.trackUri, token);
        if (trackData && trackData.album && trackData.album.external_urls?.spotify) {
          const albumUri = trackData.album.external_urls.spotify.replace('https://open.spotify.com/album/', 'spotify:album:');
          albumData = await getAlbumByUri(albumUri, token);
          if (albumData) {
            matchSource = 'uri';
            console.log(`  ✅ Found via URI: ${albumData.name} by ${albumData.artists[0]?.name}`);
          }
        }
      }
      
      // If URI lookup failed, we could fall back to search, but let's be strict
      if (!albumData) {
        console.log(`  ⚠️  No URI found for "${albumName}", skipping`);
      }
      
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: albumData,
        image: albumData?.images?.[0]?.url || null,
        spotifyUrl: albumData?.external_urls?.spotify || null,
        artist: albumData?.artists?.[0]?.name || null,
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
        artist: null,
        matchSource: 'error'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
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
    const enrichedTracks = await enrichTracksWithUris(topTracks, trackUriMap, token);
    const enrichedAlbums = await enrichAlbumsWithUris(topAlbums, albumUriMap, trackUriMap, token);
    
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
  const enrichedTracks = await enrichTracksWithUris(topTracks, trackUriMap, token);
  const enrichedAlbums = await enrichAlbumsWithUris(topAlbums, albumUriMap, trackUriMap, token);
  
  return {
    artists: enrichedArtists,
    tracks: enrichedTracks,
    albums: enrichedAlbums,
    lifetimeStats: lifetimeData
  };
}

(async () => {
  try {
    console.log('🎵 Starting URI-based Spotify data enrichment...');
    
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
    
    // Build URI maps
    const { trackUriMap, albumUriMap } = buildUriMaps(consolidatedData);
    
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
        apiDelay: CONFIG.API_DELAY,
        uriBasedMatching: true,
        trackUriCount: trackUriMap.size,
        albumUriCount: albumUriMap.size
      }
    };
    
    // Save to public directory
    const outputPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2));
    
    console.log('\n✅ URI-based Spotify data enrichment completed!');
    console.log(`📈 Successfully enriched data for ${Object.keys(yearlyEnriched).length} years + lifetime`);
    console.log(`💾 Saved to: ${outputPath}`);
    
    // Print summary with match statistics
    const totalArtists = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.artists.length, 0) + lifetimeEnriched.artists.length;
    const totalTracks = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.tracks.length, 0) + lifetimeEnriched.tracks.length;
    const totalAlbums = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.albums.length, 0) + lifetimeEnriched.albums.length;
    
    // Count successful matches
    const uriMatches = Object.values(yearlyEnriched).reduce((sum, year) => {
      return sum + year.tracks.filter(t => t.matchSource === 'uri').length + 
             year.albums.filter(a => a.matchSource === 'uri').length;
    }, 0) + lifetimeEnriched.tracks.filter(t => t.matchSource === 'uri').length + 
      lifetimeEnriched.albums.filter(a => a.matchSource === 'uri').length;
    
    console.log(`📊 Total enriched: ${totalArtists} artists, ${totalTracks} tracks, ${totalAlbums} albums`);
    console.log(`🎯 URI-based matches: ${uriMatches} items`);
    console.log(`📈 Match rate: ${Math.round((uriMatches / (totalTracks + totalAlbums)) * 100)}%`);
    
  } catch (error) {
    console.error('❌ Error enriching Spotify data:', error.message);
    process.exit(1);
  }
})();
