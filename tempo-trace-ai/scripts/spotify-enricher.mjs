#!/usr/bin/env node

/**
 * SINGLE Spotify Enrichment Script
 * 
 * This script replaces all the previous Spotify fetchers with one standardized approach:
 * 1. Reads raw Spotify streaming history files
 * 2. Builds accurate track-to-artist mappings
 * 3. Enriches both lifetime and yearly data
 * 4. Outputs optimized JSON files
 * 
 * Usage: npm run enrich-spotify
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CONFIG = {
  SPOTIFY_API_BASE: 'https://api.spotify.com/v1',
  RAW_DATA_DIR: '../music-data-processor/input/Spotify Extended Streaming History',
  OUTPUT_DIR: 'public/data',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
};

// Global token cache
let accessToken = null;
let tokenExpiry = 0;

/**
 * Get Spotify access token using client credentials flow
 */
async function getSpotifyToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env file');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Failed to get Spotify token: ${response.statusText}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer

  return accessToken;
}

/**
 * Clean Spotify API response to remove unnecessary fields
 */
function cleanSpotifyData(data, type) {
  if (!data) return null;
  
  const cleaned = { ...data };
  
  // Remove large unnecessary fields
  delete cleaned.available_markets;
  delete cleaned.external_urls;
  delete cleaned.href;
  delete cleaned.uri;
  
  // Keep only essential fields
  const essentialFields = {
    track: ['id', 'name', 'artists', 'album', 'preview_url', 'external_urls'],
    album: ['id', 'name', 'artists', 'images', 'release_date', 'external_urls'],
    artist: ['id', 'name', 'images', 'external_urls']
  };
  
  if (essentialFields[type]) {
    const fieldsToKeep = essentialFields[type];
    Object.keys(cleaned).forEach(key => {
      if (!fieldsToKeep.includes(key)) {
        delete cleaned[key];
      }
    });
  }
  
  return cleaned;
}

/**
 * Search Spotify for a track with artist context
 */
async function searchSpotifyTrack(trackName, artistName, token) {
  const query = `track:"${trackName}" artist:"${artistName}"`;
  const response = await fetch(`${CONFIG.SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) return null;
  
  const data = await response.json();
  return data.tracks?.items?.[0] || null;
}

/**
 * Get Spotify data by URI
 */
async function getSpotifyByUri(uri, token) {
  if (!uri || !uri.startsWith('spotify:')) return null;
  
  const type = uri.split(':')[1];
  const id = uri.split(':')[2];
  
  const response = await fetch(`${CONFIG.SPOTIFY_API_BASE}/${type}s/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) return null;
  
  return await response.json();
}

/**
 * Build track-to-artist mapping from raw Spotify data
 */
function buildTrackArtistMap() {
  const map = new Map();
  const rawDataDir = path.join(process.cwd(), CONFIG.RAW_DATA_DIR);
  
  if (!fs.existsSync(rawDataDir)) {
    console.log('⚠️  Raw Spotify data directory not found, using search-only approach');
    return map;
  }

  const files = fs.readdirSync(rawDataDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const filePath = path.join(rawDataDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      for (const entry of data) {
        const track = entry.master_metadata_track_name;
        const artist = entry.master_metadata_album_artist_name;
        const uri = entry.spotify_track_uri;
        
        if (track && artist) {
          const key = `${track}|${artist}`;
          if (!map.has(key)) {
            map.set(key, { track, artist, uri });
          }
        }
      }
    } catch (error) {
      console.log(`⚠️  Error reading ${file}: ${error.message}`);
    }
  }
  
  console.log(`📊 Built track-artist map with ${map.size} entries`);
  return map;
}

/**
 * Enrich a list of items with Spotify data
 */
async function enrichItems(items, type, trackArtistMap, token) {
  const enriched = [];
  
  for (const item of items) {
    let trackName, artistName, playCount;
    
    // Handle different data formats
    if (Array.isArray(item)) {
      [trackName, playCount, artistName] = item;
    } else if (typeof item === 'object') {
      trackName = item.name || item.track;
      playCount = item.plays || item.playCount;
      artistName = item.artist;
    } else {
      trackName = item;
      playCount = 1;
    }
    
    if (!trackName) continue;
    
    let spotifyData = null;
    let spotifyUrl = null;
    
    // Try to find in track-artist map first
    const mapKey = `${trackName}|${artistName}`;
    const mapEntry = trackArtistMap.get(mapKey);
    
    if (mapEntry?.uri) {
      // Use URI for exact match
      spotifyData = await getSpotifyByUri(mapEntry.uri, token);
      if (spotifyData) {
        spotifyUrl = spotifyData.external_urls?.spotify;
      }
    }
    
    // Fallback to search if URI lookup failed
    if (!spotifyData && artistName) {
      spotifyData = await searchSpotifyTrack(trackName, artistName, token);
      if (spotifyData) {
        spotifyUrl = spotifyData.external_urls?.spotify;
      }
    }
    
    // Clean the data
    if (spotifyData) {
      spotifyData = cleanSpotifyData(spotifyData, type);
    }
    
    enriched.push({
      name: trackName,
      plays: playCount,
      artist: artistName,
      spotifyData,
      spotifyUrl
    });
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return enriched;
}

/**
 * Main enrichment function
 */
async function enrichSpotifyData() {
  console.log('🚀 Starting Spotify enrichment...');
  
  try {
    // Get Spotify token
    const token = await getSpotifyToken();
    console.log('✅ Spotify token obtained');
    
    // Build track-artist mapping
    const trackArtistMap = buildTrackArtistMap();
    
    // Load processed data
    const lifetimeDataPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'lifetime_streaming_stats.json');
    const annualDataPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'annual_recaps.json');
    
    if (!fs.existsSync(lifetimeDataPath) || !fs.existsSync(annualDataPath)) {
      throw new Error('Processed data files not found. Run music-data-processor first.');
    }
    
    const lifetimeData = JSON.parse(fs.readFileSync(lifetimeDataPath, 'utf8'));
    const annualData = JSON.parse(fs.readFileSync(annualDataPath, 'utf8'));
    
    // Enrich lifetime data
    console.log('📊 Enriching lifetime data...');
    const lifetimeEnriched = {
      artists: await enrichItems(lifetimeData.top_lists.top_artists, 'artist', trackArtistMap, token),
      tracks: await enrichItems(lifetimeData.top_lists.top_track_artists || lifetimeData.top_lists.top_tracks, 'track', trackArtistMap, token),
      albums: await enrichItems(lifetimeData.top_lists.top_albums, 'album', trackArtistMap, token)
    };
    
    // Enrich yearly data
    console.log('📊 Enriching yearly data...');
    const yearlyEnriched = {};
    
    for (const [year, yearData] of Object.entries(annualData)) {
      yearlyEnriched[year] = {
        artists: await enrichItems(yearData.top_artists, 'artist', trackArtistMap, token),
        tracks: await enrichItems(yearData.top_track_artists || yearData.top_tracks, 'track', trackArtistMap, token),
        albums: await enrichItems(yearData.top_albums, 'album', trackArtistMap, token)
      };
    }
    
    // Save enriched data
    const outputData = {
      lifetime: lifetimeEnriched,
      yearly: yearlyEnriched,
      lastUpdated: new Date().toISOString(),
      config: {
        totalTracks: trackArtistMap.size,
        yearsProcessed: Object.keys(yearlyEnriched).length
      }
    };
    
    // Save separate files for better performance
    const lifetimePath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'spotify_enriched_lifetime.json');
    fs.writeFileSync(lifetimePath, JSON.stringify({ lifetime: lifetimeEnriched, lastUpdated: outputData.lastUpdated, config: outputData.config }, null, 2));
    
    const yearlyPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'spotify_enriched_yearly.json');
    fs.writeFileSync(yearlyPath, JSON.stringify({ yearly: yearlyEnriched, lastUpdated: outputData.lastUpdated, config: outputData.config }, null, 2));
    
    // Summary
    const totalItems = lifetimeEnriched.artists.length + lifetimeEnriched.tracks.length + lifetimeEnriched.albums.length;
    const totalYearlyItems = Object.values(yearlyEnriched).reduce((sum, year) => 
      sum + year.artists.length + year.tracks.length + year.albums.length, 0);
    
    console.log('✅ Spotify enrichment completed!');
    console.log(`📊 Lifetime items enriched: ${totalItems}`);
    console.log(`📊 Yearly items enriched: ${totalYearlyItems}`);
    console.log(`📊 Years processed: ${Object.keys(yearlyEnriched).length}`);
    console.log(`💾 Files saved: spotify_enriched_lifetime.json, spotify_enriched_yearly.json`);
    
  } catch (error) {
    console.error('❌ Spotify enrichment failed:', error.message);
    process.exit(1);
  }
}

// Run the enrichment
enrichSpotifyData();
