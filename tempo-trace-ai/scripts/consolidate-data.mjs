#!/usr/bin/env node

/**
 * Data Consolidation Script
 * 
 * This script consolidates base data with Spotify enrichment into optimized files:
 * 1. Combines lifetime_streaming_stats.json + spotify_enriched_lifetime.json
 * 2. Combines annual_recaps.json + spotify_enriched_yearly.json
 * 3. Creates single files per use case for better performance
 * 
 * Usage: npm run consolidate-data
 */

import fs from 'fs';
import path from 'path';

const CONFIG = {
  DATA_DIR: 'public/data',
  OUTPUT_DIR: 'public/data'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function loadJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`File not found: ${filePath}`, 'warning');
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    log(`Error loading ${filePath}: ${error.message}`, 'error');
    return null;
  }
}

function saveJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    log(`Saved: ${path.basename(filePath)}`, 'success');
    return true;
  } catch (error) {
    log(`Error saving ${filePath}: ${error.message}`, 'error');
    return false;
  }
}

function consolidateLifetimeData() {
  log('🔄 Consolidating lifetime data...', 'info');
  
  const baseDataPath = path.join(process.cwd(), CONFIG.DATA_DIR, 'lifetime_streaming_stats.json');
  const spotifyDataPath = path.join(process.cwd(), CONFIG.DATA_DIR, 'spotify_enriched_lifetime.json');
  
  const baseData = loadJsonFile(baseDataPath);
  const spotifyData = loadJsonFile(spotifyDataPath);
  
  if (!baseData) {
    log('❌ Base lifetime data not found', 'error');
    return false;
  }
  
  if (!spotifyData) {
    log('⚠️  Spotify lifetime data not found, saving base data only', 'warning');
    const outputPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'lifetime_data.json');
    return saveJsonFile(outputPath, baseData);
  }
  
  // Merge the data
  const consolidatedData = {
    ...baseData,
    spotify: {
      artists: spotifyData.lifetime?.artists || [],
      tracks: spotifyData.lifetime?.tracks || [],
      albums: spotifyData.lifetime?.albums || []
    },
    lastUpdated: spotifyData.lastUpdated,
    config: spotifyData.config
  };
  
  const outputPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'lifetime_data.json');
  return saveJsonFile(outputPath, consolidatedData);
}

function consolidateYearlyData() {
  log('🔄 Consolidating yearly data...', 'info');
  
  const baseDataPath = path.join(process.cwd(), CONFIG.DATA_DIR, 'annual_recaps.json');
  const spotifyDataPath = path.join(process.cwd(), CONFIG.DATA_DIR, 'spotify_enriched_yearly.json');
  
  const baseData = loadJsonFile(baseDataPath);
  const spotifyData = loadJsonFile(spotifyDataPath);
  
  if (!baseData) {
    log('❌ Base yearly data not found', 'error');
    return false;
  }
  
  if (!spotifyData) {
    log('⚠️  Spotify yearly data not found, saving base data only', 'warning');
    const outputPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'yearly_data.json');
    return saveJsonFile(outputPath, baseData);
  }
  
  // Merge the data for each year
  const consolidatedData = {};
  
  for (const [year, yearBaseData] of Object.entries(baseData)) {
    const yearSpotifyData = spotifyData.yearly?.[year];
    
    consolidatedData[year] = {
      ...yearBaseData,
      spotify: {
        artists: yearSpotifyData?.artists || [],
        tracks: yearSpotifyData?.tracks || [],
        albums: yearSpotifyData?.albums || []
      }
    };
  }
  
  // Add metadata
  consolidatedData._metadata = {
    lastUpdated: spotifyData.lastUpdated,
    config: spotifyData.config
  };
  
  const outputPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'yearly_data.json');
  return saveJsonFile(outputPath, consolidatedData);
}

function consolidateConcertData() {
  log('🔄 Consolidating concert data...', 'info');
  
  const artistDataPath = path.join(process.cwd(), CONFIG.DATA_DIR, 'artist_summary.json');
  const concertDataPath = path.join(process.cwd(), CONFIG.DATA_DIR, 'concerts.json');
  
  const artistData = loadJsonFile(artistDataPath);
  const concertData = loadJsonFile(concertDataPath);
  
  if (!artistData || !concertData) {
    log('⚠️  Artist or concert data not found, skipping consolidation', 'warning');
    return false;
  }
  
  const consolidatedData = {
    artists: artistData,
    concerts: concertData,
    lastUpdated: new Date().toISOString()
  };
  
  const outputPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, 'concert_data.json');
  return saveJsonFile(outputPath, consolidatedData);
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024 / 1024).toFixed(2) + 'MB';
  } catch (error) {
    return 'N/A';
  }
}

function showOptimizationSummary() {
  log('📊 Optimization Summary:', 'info');
  
  const files = [
    'lifetime_data.json',
    'yearly_data.json', 
    'concert_data.json'
  ];
  
  let totalSize = 0;
  
  for (const file of files) {
    const filePath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, file);
    if (fs.existsSync(filePath)) {
      const size = getFileSize(filePath);
      log(`  ${file}: ${size}`, 'info');
    }
  }
  
  // Show what we're replacing
  log('📊 Replaced files:', 'info');
  const oldFiles = [
    'lifetime_streaming_stats.json',
    'spotify_enriched_lifetime.json',
    'annual_recaps.json',
    'spotify_enriched_yearly.json',
    'spotify_enriched_data.json',
    'artist_summary.json',
    'concerts.json'
  ];
  
  for (const file of oldFiles) {
    const filePath = path.join(process.cwd(), CONFIG.DATA_DIR, file);
    if (fs.existsSync(filePath)) {
      const size = getFileSize(filePath);
      log(`  ${file}: ${size} (can be removed)`, 'info');
    }
  }
}

async function main() {
  log('🚀 Starting data consolidation...', 'info');
  
  try {
    // Consolidate lifetime data
    const lifetimeResult = consolidateLifetimeData();
    if (!lifetimeResult) {
      log('❌ Lifetime data consolidation failed', 'error');
      process.exit(1);
    }
    
    // Consolidate yearly data
    const yearlyResult = consolidateYearlyData();
    if (!yearlyResult) {
      log('❌ Yearly data consolidation failed', 'error');
      process.exit(1);
    }
    
    // Consolidate concert data
    const concertResult = consolidateConcertData();
    if (!concertResult) {
      log('⚠️  Concert data consolidation failed, continuing...', 'warning');
    }
    
    // Show summary
    showOptimizationSummary();
    
    log('🎉 Data consolidation completed!', 'success');
    log('💡 Next steps:', 'info');
    log('  1. Update components to use new consolidated files', 'info');
    log('  2. Test the application', 'info');
    log('  3. Remove old redundant files', 'info');
    
  } catch (error) {
    log(`❌ Unexpected error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the consolidation
main();
