import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Read the existing data to get the top lists
const dataPath = path.join(process.cwd(), 'public/data/lifetime_streaming_stats.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

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

async function enrichArtists(artists, token) {
  const enriched = [];
  
  for (const [artistName, playCount] of artists) {
    console.log(`Fetching data for artist: ${artistName}`);
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
      console.error(`Error fetching data for artist "${artistName}":`, error.message);
      enriched.push({
        name: artistName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null
      });
    }
    
    // Be polite to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return enriched;
}

async function enrichTracks(tracks, token) {
  const enriched = [];
  
  for (const [trackName, playCount] of tracks) {
    console.log(`Fetching data for track: ${trackName}`);
    try {
      const trackData = await searchTrack(trackName, '', token);
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: trackData,
        image: trackData?.album?.images?.[0]?.url || null,
        spotifyUrl: trackData?.external_urls?.spotify || null,
        artist: trackData?.artists?.[0]?.name || null
      });
    } catch (error) {
      console.error(`Error fetching data for track "${trackName}":`, error.message);
      enriched.push({
        name: trackName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null,
        artist: null
      });
    }
    
    // Be polite to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return enriched;
}

async function enrichAlbums(albums, token) {
  const enriched = [];
  
  for (const [albumName, playCount] of albums) {
    console.log(`Fetching data for album: ${albumName}`);
    try {
      const albumData = await searchAlbum(albumName, '', token);
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: albumData,
        image: albumData?.images?.[0]?.url || null,
        spotifyUrl: albumData?.external_urls?.spotify || null,
        artist: albumData?.artists?.[0]?.name || null
      });
    } catch (error) {
      console.error(`Error fetching data for album "${albumName}":`, error.message);
      enriched.push({
        name: albumName,
        plays: playCount,
        spotifyData: null,
        image: null,
        spotifyUrl: null,
        artist: null
      });
    }
    
    // Be polite to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return enriched;
}

(async () => {
  try {
    console.log('🎵 Starting Spotify data enrichment...');
    
    const token = await getToken();
    console.log('✅ Got Spotify access token');
    
    // Get the top lists from the data
    const topArtists = data.top_lists.top_artists.slice(0, 10);
    const topTracks = data.top_lists.top_tracks.slice(0, 10);
    const topAlbums = data.top_lists.top_albums.slice(0, 10);
    
    console.log(`📊 Found ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums`);
    
    // Enrich the data
    const enrichedArtists = await enrichArtists(topArtists, token);
    const enrichedTracks = await enrichTracks(topTracks, token);
    const enrichedAlbums = await enrichAlbums(topAlbums, token);
    
    // Create the enriched data object
    const enrichedData = {
      artists: enrichedArtists,
      tracks: enrichedTracks,
      albums: enrichedAlbums,
      lastUpdated: new Date().toISOString()
    };
    
    // Save to public directory
    const outputPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2));
    
    console.log('✅ Saved enriched Spotify data to public/data/spotify_enriched_data.json');
    console.log(`📈 Successfully enriched ${enrichedArtists.length} artists, ${enrichedTracks.length} tracks, ${enrichedAlbums.length} albums`);
    
  } catch (error) {
    console.error('❌ Error enriching Spotify data:', error.message);
    process.exit(1);
  }
})();
