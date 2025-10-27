import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  ITEMS_PER_CATEGORY: 10, // Top N items to enrich
  API_DELAY: 2000, // 2 second delay to avoid rate limits
  MAX_RETRIES: 3
};

// Helper functions from raw-spotify-fetcher
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

async function searchAlbum(query, token, limit = 1) {
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'album');
  url.searchParams.set('limit', limit);

  const response = await fetch(url, { 
    headers: { Authorization: `Bearer ${token}` } 
  });
  const json = await response.json();
  
  if (limit === 1) {
    return json?.albums?.items?.[0] || null;
  }
  return json?.albums?.items || [];
}

function cleanSpotifyData(data, type) {
  if (!data) return null;
  
  const cleaned = {
    id: data.id,
    name: data.name,
    type: data.type,
    uri: data.uri,
    external_urls: data.external_urls,
    images: data.images,
    popularity: data.popularity
  };
  
  if (type === 'track') {
    cleaned.artists = data.artists?.map(artist => ({
      id: artist.id,
      name: artist.name,
      type: artist.type,
      uri: artist.uri,
      external_urls: artist.external_urls
    }));
    cleaned.album = data.album ? {
      id: data.album.id,
      name: data.album.name,
      type: data.album.type,
      uri: data.album.uri,
      external_urls: data.album.external_urls,
      images: data.album.images,
      album_type: data.album.album_type,
      total_tracks: data.album.total_tracks
    } : null;
  } else if (type === 'album') {
    cleaned.artists = data.artists?.map(artist => ({
      id: artist.id,
      name: artist.name,
      type: artist.type,
      uri: artist.uri,
      external_urls: artist.external_urls
    }));
    cleaned.album_type = data.album_type;
    cleaned.total_tracks = data.total_tracks;
    cleaned.label = data.label;
    cleaned.genres = data.genres;
  } else if (type === 'artist') {
    cleaned.genres = data.genres;
    cleaned.followers = data.followers;
  }
  
  return cleaned;
}

// Fetch missing data
async function enrichMissingArtist(artistName, token) {
  console.log(`  🎤 Enriching artist: ${artistName}`);
  const data = await searchArtist(artistName, token);
  await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  
  return {
    spotifyData: cleanSpotifyData(data, 'artist'),
    image: data?.images?.[0]?.url || null,
    spotifyUrl: data?.external_urls?.spotify || null
  };
}

async function enrichMissingTrack(trackName, artistName, token) {
  console.log(`  🎵 Enriching track: ${trackName} by ${artistName}`);
  const query = `${trackName} artist:${artistName}`;
  const data = await searchTrack(query, token);
  await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  
  return {
    spotifyData: cleanSpotifyData(data, 'track'),
    image: data?.album?.images?.[0]?.url || null,
    spotifyUrl: data?.external_urls?.spotify || null
  };
}

async function enrichMissingAlbum(albumName, artistName, token) {
  console.log(`  💿 Enriching album: ${albumName}${artistName ? ' by ' + artistName : ''}`);
  const query = artistName ? `${albumName} artist:${artistName}` : albumName;
  const results = await searchAlbum(query, token, 5);
  await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
  
  // If we have results, use the first one
  const data = results?.[0] || null;
  
  // If no artist specified and we got results, log a warning about potential mismatch
  if (!artistName && data) {
    const spotifyArtist = data.artists?.[0]?.name;
    console.log(`    ⚠️  No artist specified, found: ${data.name} by ${spotifyArtist}`);
  }
  
  return {
    spotifyData: cleanSpotifyData(data, 'album'),
    image: data?.images?.[0]?.url || null,
    spotifyUrl: data?.external_urls?.spotify || null
  };
}

// Compare and find missing items
function findMissingArtists(currentEnriched, processedData) {
  const missing = [];
  const enrichedMap = new Map(currentEnriched.map(item => [item.name.toLowerCase(), item]));
  
  processedData.forEach(([name, plays, msPlayed]) => {
    const existing = enrichedMap.get(name.toLowerCase());
    if (!existing || !existing.image || !existing.spotifyUrl) {
      missing.push({ name, plays, msPlayed });
    }
  });
  
  return missing;
}

function findMissingTracks(currentEnriched, processedData) {
  const missing = [];
  const enrichedMap = new Map();
  
  currentEnriched.forEach(item => {
    const key = `${item.name.toLowerCase()}|${item.artist?.toLowerCase() || ''}`;
    enrichedMap.set(key, item);
  });
  
  processedData.forEach(([name, plays, artist, msPlayed]) => {
    const key = `${name.toLowerCase()}|${artist?.toLowerCase() || ''}`;
    const existing = enrichedMap.get(key);
    if (!existing || !existing.image || !existing.spotifyUrl) {
      missing.push({ name, plays, artist, msPlayed });
    }
  });
  
  return missing;
}

function findMissingAlbums(currentEnriched, processedData) {
  const missing = [];
  const enrichedMap = new Map();
  
  currentEnriched.forEach(item => {
    const key = item.name.toLowerCase();
    enrichedMap.set(key, item);
  });
  
  processedData.forEach(item => {
    // Format is [name, plays, ms_played]
    const name = item[0];
    const plays = item[1];
    const msPlayed = item[2];
    
    const key = name.toLowerCase();
    const existing = enrichedMap.get(key);
    if (!existing || !existing.image || !existing.spotifyUrl) {
      missing.push({ name, plays, msPlayed });
    }
  });
  
  return missing;
}

async function main() {
  try {
    console.log('🎵 Starting Incremental Spotify Enrichment...');
    
    const dataPath = path.join(process.cwd(), 'public/data');
    
    // Read existing enriched data
    const enrichedPath = path.join(dataPath, 'spotify_enriched_data.json');
    if (!fs.existsSync(enrichedPath)) {
      console.log('❌ No existing enriched data found. Run full enrichment first.');
      process.exit(1);
    }
    
    const enrichedData = JSON.parse(fs.readFileSync(enrichedPath, 'utf8'));
    console.log('✅ Loaded existing enriched data');
    
    // Read processed data
    const lifetimeData = JSON.parse(fs.readFileSync(path.join(dataPath, 'lifetime_streaming_stats.json'), 'utf8'));
    const annualRecaps = JSON.parse(fs.readFileSync(path.join(dataPath, 'annual_recaps.json'), 'utf8'));
    console.log('✅ Loaded processed data');
    
    // Get Spotify token
    const token = await getToken();
    console.log('✅ Got Spotify access token');
    
    let totalEnriched = 0;
    let totalMissing = 0;
    
    // Process lifetime data
    console.log('\n📊 Checking lifetime data...');
    
    // Artists
    const lifetimeArtists = lifetimeData.top_lists.top_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const missingLifetimeArtists = findMissingArtists(enrichedData.lifetime.artists, lifetimeArtists);
    if (missingLifetimeArtists.length > 0) {
      console.log(`  Found ${missingLifetimeArtists.length} missing lifetime artists`);
      for (const item of missingLifetimeArtists) {
        const existing = enrichedData.lifetime.artists.find(a => a.name === item.name);
        const enriched = await enrichMissingArtist(item.name, token);
        if (enriched.image && enriched.spotifyUrl) {
          if (existing) {
            Object.assign(existing, enriched);
          } else {
            enrichedData.lifetime.artists.push({ name: item.name, plays: item.plays, msPlayed: item.msPlayed, ...enriched, artist: item.name });
          }
          totalEnriched++;
        } else {
          console.log(`    ⚠️  Could not find data for ${item.name}`);
        }
        totalMissing++;
      }
    }
    
    // Tracks
    const lifetimeTracks = lifetimeData.top_lists.top_track_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const missingLifetimeTracks = findMissingTracks(enrichedData.lifetime.tracks, lifetimeTracks);
    if (missingLifetimeTracks.length > 0) {
      console.log(`  Found ${missingLifetimeTracks.length} missing lifetime tracks`);
      for (const item of missingLifetimeTracks) {
        const existing = enrichedData.lifetime.tracks.find(t => t.name === item.name && t.artist === item.artist);
        const enriched = await enrichMissingTrack(item.name, item.artist, token);
        if (enriched.image && enriched.spotifyUrl) {
          if (existing) {
            Object.assign(existing, enriched);
          } else {
            enrichedData.lifetime.tracks.push({ name: item.name, plays: item.plays, artist: item.artist, ...enriched });
          }
          totalEnriched++;
        } else {
          console.log(`    ⚠️  Could not find data for ${item.name} by ${item.artist}`);
        }
        totalMissing++;
      }
    }
    
    // Albums
    const lifetimeAlbums = lifetimeData.top_lists.top_album_artists ? lifetimeData.top_lists.top_album_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY) : lifetimeData.top_lists.top_albums.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const missingLifetimeAlbums = findMissingAlbums(enrichedData.lifetime.albums, lifetimeAlbums);
    if (missingLifetimeAlbums.length > 0) {
      console.log(`  Found ${missingLifetimeAlbums.length} missing lifetime albums`);
      for (const item of missingLifetimeAlbums) {
        const existing = enrichedData.lifetime.albums.find(a => a.name === item.name && (!item.artist || a.artist === item.artist));
        const enriched = await enrichMissingAlbum(item.name, item.artist || null, token);
        if (enriched.image && enriched.spotifyUrl) {
          if (existing) {
            Object.assign(existing, enriched);
          } else {
            enrichedData.lifetime.albums.push({ name: item.name, plays: item.plays, artist: item.artist, ...enriched });
          }
          totalEnriched++;
        } else {
          console.log(`    ⚠️  Could not find data for ${item.name} by ${item.artist}`);
        }
        totalMissing++;
      }
    }
    
    // Process yearly data
    console.log('\n📅 Checking yearly data...');
    const years = Object.keys(annualRecaps).sort().reverse();
    
    for (const year of years) {
      const yearData = annualRecaps[year];
      const yearEnriched = enrichedData.yearly[year];
      
      if (!yearEnriched) {
        console.log(`  ⚠️  No enriched data for ${year}, skipping`);
        continue;
      }
      
      // Artists
      const yearArtists = yearData.top_artists.slice(0, 10);
      const missingYearArtists = findMissingArtists(yearEnriched.artists, yearArtists);
      if (missingYearArtists.length > 0) {
        console.log(`  ${year}: Found ${missingYearArtists.length} missing artists`);
        for (const item of missingYearArtists) {
          const existing = yearEnriched.artists.find(a => a.name === item.name);
          const enriched = await enrichMissingArtist(item.name, token);
          if (enriched.image && enriched.spotifyUrl) {
            if (existing) {
              Object.assign(existing, enriched);
            } else {
              yearEnriched.artists.push({ name: item.name, plays: item.plays, ...enriched, artist: item.name });
            }
            totalEnriched++;
          } else {
            console.log(`    ⚠️  Could not find data for ${item.name}`);
          }
          totalMissing++;
        }
      }
      
      // Tracks
      if (yearData.top_track_artists) {
        const yearTracks = yearData.top_track_artists.slice(0, 10);
        const missingYearTracks = findMissingTracks(yearEnriched.tracks, yearTracks);
        if (missingYearTracks.length > 0) {
          console.log(`  ${year}: Found ${missingYearTracks.length} missing tracks`);
          for (const item of missingYearTracks) {
            const existing = yearEnriched.tracks.find(t => t.name === item.name && t.artist === item.artist);
            const enriched = await enrichMissingTrack(item.name, item.artist, token);
            if (enriched.image && enriched.spotifyUrl) {
              if (existing) {
                Object.assign(existing, enriched);
              } else {
                yearEnriched.tracks.push({ name: item.name, plays: item.plays, artist: item.artist, ...enriched });
              }
              totalEnriched++;
            } else {
              console.log(`    ⚠️  Could not find data for ${item.name} by ${item.artist}`);
            }
            totalMissing++;
          }
        }
      }
      
      // Albums
      if (yearData.top_album_artists) {
        const yearAlbums = yearData.top_album_artists.slice(0, 10);
        const missingYearAlbums = findMissingAlbums(yearEnriched.albums, yearAlbums);
        if (missingYearAlbums.length > 0) {
          console.log(`  ${year}: Found ${missingYearAlbums.length} missing albums`);
          for (const item of missingYearAlbums) {
            const existing = yearEnriched.albums.find(a => a.name === item.name && a.artist === item.artist);
            const enriched = await enrichMissingAlbum(item.name, item.artist, token);
            if (enriched.image && enriched.spotifyUrl) {
              if (existing) {
                Object.assign(existing, enriched);
              } else {
                yearEnriched.albums.push({ name: item.name, plays: item.plays, artist: item.artist, ...enriched });
              }
              totalEnriched++;
            } else {
              console.log(`    ⚠️  Could not find data for ${item.name} by ${item.artist}`);
            }
            totalMissing++;
          }
        }
      }
    }
    
    // Update lastUpdated timestamp
    enrichedData.lastUpdated = new Date().toISOString();
    
    // Save updated data
    fs.writeFileSync(enrichedPath, JSON.stringify(enrichedData, null, 2));
    
    console.log('\n✅ Incremental enrichment complete!');
    console.log(`📊 Summary:`);
    console.log(`  - Checked: ${totalMissing} items`);
    console.log(`  - Successfully enriched: ${totalEnriched} items`);
    console.log(`  - Saved to: ${enrichedPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

