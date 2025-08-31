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

async function searchTrack(query, token) {
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

function buildRawSpotifyMaps() {
  console.log('🔗 Building maps from raw Spotify streaming data...');
  
  const trackMap = new Map(); // track name -> { uri, artist, album }
  const albumMap = new Map(); // album name -> { uri, artist }
  
  // Read all raw Spotify files
  const spotifyDir = path.join(process.cwd(), '../music-data-processor/input/Spotify Extended Streaming History');
  
  if (!fs.existsSync(spotifyDir)) {
    console.log('⚠️  Raw Spotify data directory not found');
    return { trackMap, albumMap };
  }
  
  const files = fs.readdirSync(spotifyDir).filter(file => file.endsWith('.json'));
  console.log(`📁 Found ${files.length} Spotify files to process`);
  
  let totalRecords = 0;
  let trackCount = 0;
  let albumCount = 0;
  
  files.forEach(file => {
    const filePath = path.join(spotifyDir, file);
    console.log(`📄 Processing ${file}...`);
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      data.forEach(record => {
        totalRecords++;
        
        // Track mapping with URI
        if (record.master_metadata_track_name && 
            record.spotify_track_uri && 
            record.master_metadata_album_artist_name) {
          
          const trackName = record.master_metadata_track_name;
          const trackUri = record.spotify_track_uri;
          const artistName = record.master_metadata_album_artist_name;
          const albumName = record.master_metadata_album_album_name;
          
          // Store the most recent URI for each track
          trackMap.set(trackName, {
            uri: trackUri,
            artist: artistName,
            album: albumName
          });
          trackCount++;
        }
        
        // Album mapping (we'll get album URI from track data)
        if (record.master_metadata_album_album_name && 
            record.spotify_track_uri && 
            record.master_metadata_album_artist_name) {
          
          const albumName = record.master_metadata_album_album_name;
          const artistName = record.master_metadata_album_artist_name;
          
          if (!albumMap.has(albumName)) {
            albumMap.set(albumName, {
              artist: artistName,
              trackUri: record.spotify_track_uri // We'll use this to get album URI
            });
          }
        }
      });
      
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });
  
  console.log(`📊 Processed ${totalRecords} raw Spotify records`);
  console.log(`🎵 Track map: ${trackCount} entries`);
  console.log(`💿 Album map: ${albumCount} entries`);
  
  return { trackMap, albumMap };
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

async function enrichTracksWithRawData(tracks, trackMap, token) {
  const enriched = [];
  
  for (const track of tracks) {
    // Handle both new object format and legacy array format
    const trackName = track.name || track[0];
    const playCount = track.playCount || track[1];
    const expectedArtist = track.artist || null;
    
    console.log(`🎵 Fetching data for track: ${trackName}`);
    try {
      let trackData = null;
      let matchSource = 'none';
      
      // Get exact data from raw Spotify files
      const trackInfo = trackMap.get(trackName);
      if (trackInfo && trackInfo.uri) {
        trackData = await getTrackByUri(trackInfo.uri, token);
        if (trackData) {
          // Check if the Spotify data matches the expected artist from corrected data
          const spotifyArtist = trackData.artists[0]?.name;
          
          if (expectedArtist && spotifyArtist && spotifyArtist.toLowerCase() !== expectedArtist.toLowerCase()) {
            console.log(`  ⚠️  Artist mismatch: expected "${expectedArtist}" but got "${spotifyArtist}" from URI`);
            // Try to search for the correct track+artist combination
            const searchResult = await searchTrack(`${trackName} artist:${expectedArtist}`, token);
            if (searchResult) {
              trackData = searchResult;
              matchSource = 'search_corrected';
              console.log(`  ✅ Found via corrected search: ${trackData.name} by ${trackData.artists[0]?.name}`);
            } else {
              matchSource = 'raw_uri_mismatch';
              console.log(`  ⚠️  Using raw URI despite artist mismatch: ${trackData.name} by ${trackData.artists[0]?.name}`);
            }
          } else {
            matchSource = 'raw_uri';
            console.log(`  ✅ Found via raw URI: ${trackData.name} by ${trackData.artists[0]?.name}`);
          }
        }
      }
      
      if (!trackData) {
        console.log(`  ⚠️  No raw data found for "${trackName}", skipping`);
      }
      
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: trackData,
        image: trackData?.album?.images?.[0]?.url || null,
        spotifyUrl: trackData?.external_urls?.spotify || null,
        artist: trackData?.artists?.[0]?.name || trackInfo?.artist || expectedArtist || null,
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
        artist: trackMap.get(trackName)?.artist || expectedArtist || null,
        matchSource: 'error'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

async function enrichAlbumsWithRawData(albums, albumMap, trackMap, token) {
  const enriched = [];
  
  for (const [albumName, playCount] of albums) {
    console.log(`💿 Fetching data for album: ${albumName}`);
    try {
      let albumData = null;
      let matchSource = 'none';
      
      // Get exact data from raw Spotify files
      const albumInfo = albumMap.get(albumName);
      if (albumInfo && albumInfo.trackUri) {
        // First get the track to extract album URI
        const trackData = await getTrackByUri(albumInfo.trackUri, token);
        if (trackData && trackData.album && trackData.album.external_urls?.spotify) {
          const albumUri = trackData.album.external_urls.spotify.replace('https://open.spotify.com/album/', 'spotify:album:');
          albumData = await getAlbumByUri(albumUri, token);
          if (albumData) {
            matchSource = 'raw_uri';
            console.log(`  ✅ Found via raw URI: ${albumData.name} by ${albumData.artists[0]?.name}`);
          }
        }
      }
      
      if (!albumData) {
        console.log(`  ⚠️  No raw data found for "${albumName}", skipping`);
      }
      
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: albumData,
        image: albumData?.images?.[0]?.url || null,
        spotifyUrl: albumData?.external_urls?.spotify || null,
        artist: albumData?.artists?.[0]?.name || albumInfo?.artist || null,
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
        artist: albumMap.get(albumName)?.artist || null,
        matchSource: 'error'
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  }
  
  return enriched;
}

(async () => {
  try {
    console.log('🎵 Starting Raw Spotify data enrichment...');
    
    const token = await getToken();
    console.log('✅ Got Spotify access token');
    
    // Read the lifetime and annual data
    const dataPath = path.join(process.cwd(), 'public/data');
    const lifetimeData = JSON.parse(fs.readFileSync(path.join(dataPath, 'lifetime_streaming_stats.json'), 'utf8'));
    const annualRecaps = JSON.parse(fs.readFileSync(path.join(dataPath, 'annual_recaps.json'), 'utf8'));
    
    // Build maps from raw Spotify files
    const { trackMap, albumMap } = buildRawSpotifyMaps();
    
    // Get top items for lifetime (Pulse tab)
    const topArtists = lifetimeData.top_lists.top_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    
    // Use the new track+artist combinations if available, otherwise fall back to legacy format
    let topTracks;
    if (lifetimeData.top_lists.top_track_artists) {
      console.log('✅ Using new top_track_artists data');
      // New format: [track, playCount, artist]
      topTracks = lifetimeData.top_lists.top_track_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY).map(item => ({
        name: item[0],
        playCount: item[1],
        artist: item[2]
      }));
      console.log('Top tracks from new format:', topTracks.map(t => `${t.name} by ${t.artist} (${t.playCount} plays)`));
    } else {
      console.log('⚠️  Using legacy top_tracks data');
      // Legacy format: [track, playCount]
      topTracks = lifetimeData.top_lists.top_tracks.slice(0, CONFIG.ITEMS_PER_CATEGORY).map(item => ({
        name: item[0],
        playCount: item[1],
        artist: null
      }));
      console.log('Top tracks from legacy format:', topTracks.map(t => `${t.name} (${t.playCount} plays)`));
    }
    
    const topAlbums = lifetimeData.top_lists.top_albums.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    
    console.log(`\n🏆 Processing Pulse tab data (top ${CONFIG.ITEMS_PER_CATEGORY} each)`);
    console.log(`  📊 Found ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums`);
    
    // Enrich the lifetime data
    const enrichedArtists = await enrichArtists(topArtists, token);
    const enrichedTracks = await enrichTracksWithRawData(topTracks, trackMap, token);
    const enrichedAlbums = await enrichAlbumsWithRawData(topAlbums, albumMap, trackMap, token);
    
    // Process yearly data for Leaderboard tab
    console.log(`\n📅 Processing yearly data for Leaderboard tab...`);
    const yearlyData = {};
    const years = Object.keys(annualRecaps).sort().reverse();
    
    for (const year of years) {
      console.log(`  📊 Processing ${year}...`);
      const yearData = annualRecaps[year];
      
      // Get top items for this year (top 10 each)
      const yearArtists = yearData.top_artists.slice(0, 10);
      const yearAlbums = yearData.top_albums.slice(0, 10);
      
      // Handle tracks - use top_track_artists if available, otherwise top_tracks
      let yearTracks;
      if (yearData.top_track_artists) {
        yearTracks = yearData.top_track_artists.slice(0, 10).map(item => ({
          name: item[0],
          playCount: item[1],
          artist: item[2]
        }));
      } else {
        yearTracks = yearData.top_tracks.slice(0, 10).map(item => ({
          name: item[0],
          playCount: item[1],
          artist: null
        }));
      }
      
      // Enrich yearly data
      const yearEnrichedArtists = await enrichArtists(yearArtists, token);
      const yearEnrichedTracks = await enrichTracksWithRawData(yearTracks, trackMap, token);
      const yearEnrichedAlbums = await enrichAlbumsWithRawData(yearAlbums, albumMap, trackMap, token);
      
      yearlyData[year] = {
        artists: yearEnrichedArtists,
        tracks: yearEnrichedTracks,
        albums: yearEnrichedAlbums
      };
      
      console.log(`    ✅ ${year}: ${yearEnrichedArtists.length} artists, ${yearEnrichedTracks.length} tracks, ${yearEnrichedAlbums.length} albums`);
    }
    
    // Create the enriched data object with both lifetime and yearly data
    const enrichedData = {
      lifetime: {
        artists: enrichedArtists,
        tracks: enrichedTracks,
        albums: enrichedAlbums
      },
      yearly: yearlyData,
      lastUpdated: new Date().toISOString(),
      config: {
        itemsPerCategory: CONFIG.ITEMS_PER_CATEGORY,
        apiDelay: CONFIG.API_DELAY,
        rawSpotifyMatching: true,
        trackMapCount: trackMap.size,
        albumMapCount: albumMap.size,
        yearsProcessed: years.length
      }
    };
    
    // Save lifetime data to separate file
    const lifetimeFileData = {
      lifetime: enrichedData.lifetime,
      lastUpdated: enrichedData.lastUpdated,
      config: enrichedData.config
    };
    const lifetimePath = path.join(process.cwd(), 'public/data/spotify_enriched_lifetime.json');
    fs.writeFileSync(lifetimePath, JSON.stringify(lifetimeFileData, null, 2));
    
    // Save yearly data to separate file
    const yearlyFileData = {
      yearly: enrichedData.yearly,
      lastUpdated: enrichedData.lastUpdated,
      config: enrichedData.config
    };
    const yearlyPath = path.join(process.cwd(), 'public/data/spotify_enriched_yearly.json');
    fs.writeFileSync(yearlyPath, JSON.stringify(yearlyFileData, null, 2));
    
    // Also save combined file for backward compatibility
    const combinedPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    fs.writeFileSync(combinedPath, JSON.stringify(enrichedData, null, 2));
    
    console.log('\n✅ Raw Spotify data enrichment completed!');
    console.log(`💾 Saved lifetime data to: ${lifetimePath}`);
    console.log(`💾 Saved yearly data to: ${yearlyPath}`);
    console.log(`💾 Saved combined data to: ${combinedPath}`);
    
    // Print summary with match statistics
    const lifetimeRawMatches = enrichedTracks.filter(t => t.matchSource === 'raw_uri').length + 
                              enrichedAlbums.filter(a => a.matchSource === 'raw_uri').length;
    const lifetimeTotalItems = enrichedTracks.length + enrichedAlbums.length;
    
    // Calculate yearly statistics
    let yearlyRawMatches = 0;
    let yearlyTotalItems = 0;
    for (const year of years) {
      const yearData = yearlyData[year];
      yearlyRawMatches += yearData.tracks.filter(t => t.matchSource === 'raw_uri').length + 
                         yearData.albums.filter(a => a.matchSource === 'raw_uri').length;
      yearlyTotalItems += yearData.tracks.length + yearData.albums.length;
    }
    
    const totalRawMatches = lifetimeRawMatches + yearlyRawMatches;
    const totalItems = lifetimeTotalItems + yearlyTotalItems;
    
    console.log(`📊 Total enriched:`);
    console.log(`  🏆 Lifetime: ${enrichedArtists.length} artists, ${enrichedTracks.length} tracks, ${enrichedAlbums.length} albums`);
    console.log(`  📅 Years processed: ${years.length}`);
    console.log(`🎯 Raw URI matches: ${totalRawMatches} items`);
    console.log(`📈 Match rate: ${Math.round((totalRawMatches / totalItems) * 100)}%`);
    
  } catch (error) {
    console.error('❌ Error enriching Spotify data:', error.message);
    process.exit(1);
  }
})();
