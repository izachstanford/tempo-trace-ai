#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Complete workflow script that:
 * 1. Runs the music-data-processor to generate insights
 * 2. Runs the enhanced Spotify fetcher to enrich the data
 * 3. Provides status updates and error handling
 */

const CONFIG = {
  // Paths relative to the tempo-trace-ai directory
  MUSIC_PROCESSOR_PATH: '../music-data-processor',
  OUTPUT_DIR: 'public/data',
  ENRICHED_DATA_FILE: 'spotify_enriched_data.json'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function runCommand(command, cwd = process.cwd()) {
  try {
    log(`Running: ${command}`, 'info');
    const output = execSync(command, { 
      cwd, 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

function checkPrerequisites() {
  log('Checking prerequisites...');
  
  // Check if .env file exists
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found. Please create it with SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET', 'error');
    return false;
  }
  
  // Check if music-data-processor exists
  const processorPath = path.join(process.cwd(), CONFIG.MUSIC_PROCESSOR_PATH);
  if (!fs.existsSync(processorPath)) {
    log('⚠️  Music data processor not found at expected path. Will skip data processing step.', 'warning');
    return 'skip-processor';
  }
  
  // Check if input data exists in music-data-processor
  const inputPath = path.join(processorPath, 'input');
  if (!fs.existsSync(inputPath)) {
    log('⚠️  No input data found in music-data-processor. Will skip data processing step.', 'warning');
    return 'skip-processor';
  }
  
  log('✅ Prerequisites check passed');
  return true;
}

function processMusicData() {
  log('🎵 Starting music data processing...');
  
  const processorPath = path.join(process.cwd(), CONFIG.MUSIC_PROCESSOR_PATH);
  
  // Check if Python is available
  const pythonCheck = runCommand('python --version');
  if (!pythonCheck.success) {
    log('❌ Python not found. Please install Python 3.7+ to run the music data processor.', 'error');
    return false;
  }
  
  // Run the music data processor
  const result = runCommand('python wrapped_reimagined.py process-all', processorPath);
  
  if (!result.success) {
    log(`❌ Music data processing failed: ${result.error}`, 'error');
    log(`Output: ${result.output}`, 'error');
    return false;
  }
  
  log('✅ Music data processing completed successfully');
  log(`Output: ${result.output}`, 'info');
  return true;
}

function copyProcessedData() {
  log('📁 Copying processed data to tempo-trace-ai...');
  
  const processorPath = path.join(process.cwd(), CONFIG.MUSIC_PROCESSOR_PATH);
  const outputPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  const filesToCopy = [
    'lifetime_streaming_stats.json',
    'annual_recaps.json',
    'artist_summary.json'
  ];
  
  let copiedCount = 0;
  
  for (const file of filesToCopy) {
    const sourcePath = path.join(processorPath, 'output', file);
    const destPath = path.join(outputPath, file);
    
    if (fs.existsSync(sourcePath)) {
      try {
        fs.copyFileSync(sourcePath, destPath);
        log(`✅ Copied ${file}`, 'success');
        copiedCount++;
      } catch (error) {
        log(`❌ Failed to copy ${file}: ${error.message}`, 'error');
      }
    } else {
      log(`⚠️  ${file} not found in processor output`, 'warning');
    }
  }
  
  if (copiedCount === 0) {
    log('❌ No data files were copied. Check if the music data processor ran successfully.', 'error');
    return false;
  }
  
  log(`✅ Successfully copied ${copiedCount} data files`);
  return true;
}

function enrichSpotifyData() {
  log('🎵 Starting raw Spotify data enrichment...');
  
  const result = runCommand('npm run fetch-spotify-raw');
  
  if (!result.success) {
    log(`❌ Spotify enrichment failed: ${result.error}`, 'error');
    log(`Output: ${result.output}`, 'error');
    return false;
  }
  
  log('✅ Raw Spotify data enrichment completed successfully');
  return true;
}

function verifyResults() {
  log('🔍 Verifying results...');
  
  const enrichedDataPath = path.join(process.cwd(), CONFIG.OUTPUT_DIR, CONFIG.ENRICHED_DATA_FILE);
  
  if (!fs.existsSync(enrichedDataPath)) {
    log('❌ Enriched data file not found', 'error');
    return false;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(enrichedDataPath, 'utf8'));
    
    const yearlyCount = Object.keys(data.yearly || {}).length;
    const lifetimeArtists = data.lifetime?.artists?.length || 0;
    const lifetimeTracks = data.lifetime?.tracks?.length || 0;
    const lifetimeAlbums = data.lifetime?.albums?.length || 0;
    
    log(`✅ Verification successful:`, 'success');
    log(`   📅 Years processed: ${yearlyCount}`, 'info');
    log(`   🎤 Lifetime artists: ${lifetimeArtists}`, 'info');
    log(`   🎵 Lifetime tracks: ${lifetimeTracks}`, 'info');
    log(`   💿 Lifetime albums: ${lifetimeAlbums}`, 'info');
    
    return true;
  } catch (error) {
    log(`❌ Failed to verify enriched data: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  log('🚀 Starting complete music data processing and enrichment workflow...');
  
  try {
    // Step 1: Check prerequisites
    const prereqResult = checkPrerequisites();
    if (prereqResult === false) {
      process.exit(1);
    }
    
    // Step 2: Process music data (if available)
    if (prereqResult !== 'skip-processor') {
      const processResult = processMusicData();
      if (!processResult) {
        log('❌ Music data processing failed. Continuing with existing data...', 'warning');
      } else {
        // Step 3: Copy processed data
        const copyResult = copyProcessedData();
        if (!copyResult) {
          log('❌ Failed to copy processed data. Continuing with existing data...', 'warning');
        }
      }
    } else {
      log('ℹ️  Skipping music data processing step', 'info');
    }
    
    // Step 4: Enrich with Spotify data
    const enrichResult = enrichSpotifyData();
    if (!enrichResult) {
      log('❌ Spotify enrichment failed', 'error');
      process.exit(1);
    }
    
    // Step 5: Verify results
    const verifyResult = verifyResults();
    if (!verifyResult) {
      log('❌ Verification failed', 'error');
      process.exit(1);
    }
    
    log('🎉 Complete workflow finished successfully!', 'success');
    log('🌐 You can now run "npm run dev" to see the enhanced data in your app', 'info');
    
  } catch (error) {
    log(`❌ Unexpected error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();
