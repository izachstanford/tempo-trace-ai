import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  ITEMS_PER_CATEGORY: 20,
  API_DELAY: 150,
  MAX_RETRIES: 3,
  // Use top N artists for context matching
  TOP_ARTISTS_FOR_CONTEXT: 250
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

async function searchTrackWithContext(trackName, contextArtists, token) {
  // Try multiple search strategies
  const searchStrategies = [
    // Strategy 1: Try each context artist individually
    ...contextArtists.map(artist => `${trackName} artist:${artist}`),
    // Strategy 2: Try without quotes (broader search)
    ...contextArtists.map(artist => `${trackName} ${artist}`),
    // Strategy 3: Fallback to track name only
    trackName
  ];

  for (const query of searchStrategies) {
    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'track');
    url.searchParams.set('limit', '5'); // Get more results to choose from

    const response = await fetch(url, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    const json = await response.json();
    
    if (json?.tracks?.items?.length > 0) {
      // Find the best match from results
      const bestMatch = findBestTrackMatch(trackName, json.tracks.items, contextArtists);
      if (bestMatch) {
        console.log(`  ✅ Found "${trackName}" using query: "${query}"`);
        return bestMatch;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between strategies
  }

  console.log(`  ❌ No good match found for "${trackName}"`);
  return null;
}

async function searchAlbumWithContext(albumName, contextArtists, token) {
  // Try multiple search strategies
  const searchStrategies = [
    // Strategy 1: Try each context artist individually
    ...contextArtists.map(artist => `${albumName} artist:${artist}`),
    // Strategy 2: Try without quotes (broader search)
    ...contextArtists.map(artist => `${albumName} ${artist}`),
    // Strategy 3: Fallback to album name only
    albumName
  ];

  for (const query of searchStrategies) {
    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'album');
    url.searchParams.set('limit', '5'); // Get more results to choose from

    const response = await fetch(url, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    const json = await response.json();
    
    if (json?.albums?.items?.length > 0) {
      // Find the best match from results
      const bestMatch = findBestAlbumMatch(albumName, json.albums.items, contextArtists);
      if (bestMatch) {
        console.log(`  ✅ Found "${albumName}" using query: "${query}"`);
        return bestMatch;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between strategies
  }

  console.log(`  ❌ No good match found for "${albumName}"`);
  return null;
}

function findBestTrackMatch(trackName, tracks, contextArtists) {
  // Score each track based on name similarity and artist context
  const scoredTracks = tracks.map(track => {
    let score = 0;
    
    // Name similarity (exact match gets highest score)
    const trackNameLower = trackName.toLowerCase();
    const spotifyNameLower = track.name.toLowerCase();
    
    if (spotifyNameLower === trackNameLower) {
      score += 100;
    } else if (spotifyNameLower.includes(trackNameLower) || trackNameLower.includes(spotifyNameLower)) {
      score += 50;
    } else {
      // Use simple string similarity
      score += calculateStringSimilarity(trackNameLower, spotifyNameLower) * 30;
    }
    
    // Artist context bonus
    const trackArtists = track.artists.map(a => a.name.toLowerCase());
    for (const contextArtist of contextArtists) {
      const contextArtistLower = contextArtist.toLowerCase();
      if (trackArtists.some(artist => 
        artist === contextArtistLower || 
        artist.includes(contextArtistLower) || 
        contextArtistLower.includes(artist)
      )) {
        score += 40;
        break; // Only count the first match
      }
    }
    
    // Popularity bonus (slight preference for more popular tracks)
    score += track.popularity * 0.1;
    
    return { track, score };
  });
  
  // Sort by score and return the best match
  scoredTracks.sort((a, b) => b.score - a.score);
  const bestMatch = scoredTracks[0];
  
  // Only return if score is above threshold
  return bestMatch.score > 30 ? bestMatch.track : null;
}

function findBestAlbumMatch(albumName, albums, contextArtists) {
  // Score each album based on name similarity and artist context
  const scoredAlbums = albums.map(album => {
    let score = 0;
    
    // Name similarity (exact match gets highest score)
    const albumNameLower = albumName.toLowerCase();
    const spotifyNameLower = album.name.toLowerCase();
    
    if (spotifyNameLower === albumNameLower) {
      score += 100;
    } else if (spotifyNameLower.includes(albumNameLower) || albumNameLower.includes(spotifyNameLower)) {
      score += 50;
    } else {
      // Use simple string similarity
      score += calculateStringSimilarity(albumNameLower, spotifyNameLower) * 30;
    }
    
    // Artist context bonus
    const albumArtists = album.artists.map(a => a.name.toLowerCase());
    for (const contextArtist of contextArtists) {
      const contextArtistLower = contextArtist.toLowerCase();
      if (albumArtists.some(artist => 
        artist === contextArtistLower || 
        artist.includes(contextArtistLower) || 
        contextArtistLower.includes(artist)
      )) {
        score += 40;
        break; // Only count the first match
      }
    }
    
    // Popularity bonus (slight preference for more popular albums)
    score += album.popularity * 0.1;
    
    return { album, score };
  });
  
  // Sort by score and return the best match
  scoredAlbums.sort((a, b) => b.score - a.score);
  const bestMatch = scoredAlbums[0];
  
  // Only return if score is above threshold
  return bestMatch.score > 30 ? bestMatch.album : null;
}

function calculateStringSimilarity(str1, str2) {
  // Simple Levenshtein distance-based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function getTopArtistsForContext(lifetimeData, annualData) {
  // Get top artists from lifetime data
  const lifetimeArtists = lifetimeData.top_lists.top_artists
    .slice(0, CONFIG.TOP_ARTISTS_FOR_CONTEXT)
    .map(([name]) => name);
  
  // Also get top artists from each year to catch any we might miss
  const yearlyArtists = new Set();
  for (const yearData of Object.values(annualData)) {
    yearData.top_artists.slice(0, 50).forEach(([name]) => yearlyArtists.add(name));
  }
  
  // Combine and deduplicate
  const allArtists = new Set([...lifetimeArtists, ...yearlyArtists]);
  
  console.log(`📋 Using ${allArtists.size} artists for context matching`);
  return Array.from(allArtists);
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

async function enrichTracksWithContext(tracks, contextArtists, token) {
  const enriched = [];
  
  for (const [trackName, playCount] of tracks) {
    console.log(`🎵 Fetching data for track: ${trackName}`);
    try {
      const trackData = await searchTrackWithContext(trackName, contextArtists, token);
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

async function enrichAlbumsWithContext(albums, contextArtists, token) {
  const enriched = [];
  
  for (const [albumName, playCount] of albums) {
    console.log(`💿 Fetching data for album: ${albumName}`);
    try {
      const albumData = await searchAlbumWithContext(albumName, contextArtists, token);
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

async function processYearlyData(annualData, token, contextArtists) {
  const yearlyEnriched = {};
  
  for (const [year, yearData] of Object.entries(annualData)) {
    console.log(`\n📅 Processing year: ${year}`);
    
    // Get top items for this year
    const topArtists = yearData.top_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const topTracks = yearData.top_tracks.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    const topAlbums = yearData.top_albums.slice(0, CONFIG.ITEMS_PER_CATEGORY);
    
    console.log(`  📊 Found ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums`);
    
    // Enrich the data with context
    const enrichedArtists = await enrichArtists(topArtists, token);
    const enrichedTracks = await enrichTracksWithContext(topTracks, contextArtists, token);
    const enrichedAlbums = await enrichAlbumsWithContext(topAlbums, contextArtists, token);
    
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

async function processLifetimeData(lifetimeData, token, contextArtists) {
  console.log(`\n🏆 Processing lifetime data`);
  
  // Get top items for lifetime
  const topArtists = lifetimeData.top_lists.top_artists.slice(0, CONFIG.ITEMS_PER_CATEGORY);
  const topTracks = lifetimeData.top_lists.top_tracks.slice(0, CONFIG.ITEMS_PER_CATEGORY);
  const topAlbums = lifetimeData.top_lists.top_albums.slice(0, CONFIG.ITEMS_PER_CATEGORY);
  
  console.log(`  📊 Found ${topArtists.length} artists, ${topTracks.length} tracks, ${topAlbums.length} albums`);
  
  // Enrich the data with context
  const enrichedArtists = await enrichArtists(topArtists, token);
  const enrichedTracks = await enrichTracksWithContext(topTracks, contextArtists, token);
  const enrichedAlbums = await enrichAlbumsWithContext(topAlbums, contextArtists, token);
  
  return {
    artists: enrichedArtists,
    tracks: enrichedTracks,
    albums: enrichedAlbums,
    lifetimeStats: lifetimeData
  };
}

(async () => {
  try {
    console.log('🎵 Starting Smart Spotify data enrichment with artist context...');
    
    const token = await getToken();
    console.log('✅ Got Spotify access token');
    
    // Read the data files
    const dataPath = path.join(process.cwd(), 'public/data');
    const lifetimeData = JSON.parse(fs.readFileSync(path.join(dataPath, 'lifetime_streaming_stats.json'), 'utf8'));
    const annualData = JSON.parse(fs.readFileSync(path.join(dataPath, 'annual_recaps.json'), 'utf8'));
    
    // Get top artists for context matching
    const contextArtists = getTopArtistsForContext(lifetimeData, annualData);
    
    // Process yearly data
    const yearlyEnriched = await processYearlyData(annualData, token, contextArtists);
    
    // Process lifetime data
    const lifetimeEnriched = await processLifetimeData(lifetimeData, token, contextArtists);
    
    // Create the comprehensive enriched data object
    const enrichedData = {
      lifetime: lifetimeEnriched,
      yearly: yearlyEnriched,
      lastUpdated: new Date().toISOString(),
      config: {
        itemsPerCategory: CONFIG.ITEMS_PER_CATEGORY,
        apiDelay: CONFIG.API_DELAY,
        topArtistsForContext: CONFIG.TOP_ARTISTS_FOR_CONTEXT,
        contextArtistsCount: contextArtists.length
      }
    };
    
    // Save to public directory
    const outputPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2));
    
    console.log('\n✅ Smart Spotify data enrichment completed!');
    console.log(`📈 Successfully enriched data for ${Object.keys(yearlyEnriched).length} years + lifetime`);
    console.log(`💾 Saved to: ${outputPath}`);
    
    // Print summary
    const totalArtists = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.artists.length, 0) + lifetimeEnriched.artists.length;
    const totalTracks = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.tracks.length, 0) + lifetimeEnriched.tracks.length;
    const totalAlbums = Object.values(yearlyEnriched).reduce((sum, year) => sum + year.albums.length, 0) + lifetimeEnriched.albums.length;
    
    console.log(`📊 Total enriched: ${totalArtists} artists, ${totalTracks} tracks, ${totalAlbums} albums`);
    console.log(`🎯 Used ${contextArtists.length} artists for context matching`);
    
  } catch (error) {
    console.error('❌ Error enriching Spotify data:', error.message);
    process.exit(1);
  }
})();
