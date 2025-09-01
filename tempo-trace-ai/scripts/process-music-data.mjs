#!/usr/bin/env node

/**
 * SINGLE Music Data Processing Script
 * 
 * This script replaces the complex process-and-enrich.mjs with a simple, clear workflow:
 * 1. Runs the Python music-data-processor
 * 2. Copies output data to the web app
 * 3. Optionally runs Spotify enrichment
 * 
 * Usage: npm run process-music
 * Usage: npm run process-music -- --with-spotify
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONFIG = {
  MUSIC_PROCESSOR_PATH: '../music-data-processor',
  OUTPUT_DIR: 'public/data'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function runCommand(command, cwd = process.cwd()) {
  try {
    log(`Running: ${command}`, 'info');
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    return true;
  } catch (error) {
    log(`Command failed: ${error.message}`, 'error');
    return false;
  }
}

function copyFile(src, dest) {
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      log(`Copied: ${path.basename(src)}`, 'success');
      return true;
    } else {
      log(`Source file not found: ${src}`, 'warning');
      return false;
    }
  } catch (error) {
    log(`Failed to copy ${src}: ${error.message}`, 'error');
    return false;
  }
}

function processMusicData() {
  log('🎵 Processing music data...', 'info');
  
  const processorPath = path.join(process.cwd(), CONFIG.MUSIC_PROCESSOR_PATH);
  
  if (!fs.existsSync(processorPath)) {
    log('Music data processor not found. Skipping data processing.', 'warning');
    return false;
  }
  
  // Run the main processor
  const success = runCommand('python wrapped_reimagined.py process-all', processorPath);
  
  if (success) {
    log('✅ Music data processing completed', 'success');
    return true;
  } else {
    log('❌ Music data processing failed', 'error');
    return false;
  }
}

function copyProcessedData() {
  log('📁 Copying processed data...', 'info');
  
  const processorOutputDir = path.join(process.cwd(), CONFIG.MUSIC_PROCESSOR_PATH, 'output');
  const webAppDataDir = path.join(process.cwd(), CONFIG.OUTPUT_DIR);
  
  // Ensure output directory exists
  if (!fs.existsSync(webAppDataDir)) {
    fs.mkdirSync(webAppDataDir, { recursive: true });
  }
  
  const filesToCopy = [
    'lifetime_streaming_stats.json',
    'annual_recaps.json',
    'artist_summary.json'
  ];
  
  let successCount = 0;
  for (const file of filesToCopy) {
    const src = path.join(processorOutputDir, file);
    const dest = path.join(webAppDataDir, file);
    if (copyFile(src, dest)) {
      successCount++;
    }
  }
  
  if (successCount > 0) {
    log(`✅ Copied ${successCount}/${filesToCopy.length} data files`, 'success');
    return true;
  } else {
    log('❌ No data files were copied', 'error');
    return false;
  }
}

function runSpotifyEnrichment() {
  log('🎵 Running Spotify enrichment...', 'info');
  
  const success = runCommand('node scripts/raw-spotify-fetcher.mjs');
  
  if (success) {
    log('✅ Spotify enrichment completed', 'success');
    return true;
  } else {
    log('❌ Spotify enrichment failed', 'error');
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const withSpotify = args.includes('--with-spotify');
  
  log('🚀 Starting music data processing workflow...', 'info');
  
  try {
    // Step 1: Process music data
    const processResult = processMusicData();
    if (!processResult) {
      log('⚠️  Music data processing failed, continuing with existing data...', 'warning');
    }
    
    // Step 2: Copy processed data
    const copyResult = copyProcessedData();
    if (!copyResult) {
      log('⚠️  Failed to copy processed data, continuing with existing data...', 'warning');
    }
    
    // Step 3: Spotify enrichment (optional)
    if (withSpotify) {
      const spotifyResult = runSpotifyEnrichment();
      if (!spotifyResult) {
        log('⚠️  Spotify enrichment failed, but core data processing completed', 'warning');
      }
    }
    
    log('🎉 Music data processing workflow completed!', 'success');
    log('🌐 You can now run "npm run dev" to see your data', 'info');
    
  } catch (error) {
    log(`❌ Unexpected error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();
