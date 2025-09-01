#!/usr/bin/env node

/**
 * Merge Missing 2025 Items
 * 
 * This script takes missing 2025 items from commit 8d021be and adds them to the current data.
 * It will add missing artists, tracks, and albums that should be in the top 10.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function mergeMissing2025Items(currentData, workingData) {
  console.log('🔄 Merging missing 2025 items...');
  
  // Get the raw data to see what should be in the top 10
  const annualRecaps = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/annual_recaps.json'), 'utf8'));
  const raw2025 = annualRecaps['2025'];
  
  console.log('📊 Raw 2025 top artists:', raw2025.top_artists.slice(0, 10).map(a => a[0]));
  console.log('📊 Raw 2025 top albums:', raw2025.top_albums.slice(0, 10).map(a => a[0]));
  
  // Merge artists
  if (currentData.yearly && currentData.yearly['2025'] && workingData.yearly && workingData.yearly['2025']) {
    console.log('  📊 Merging missing 2025 artists...');
    
    // Get current artist names
    const currentArtistNames = currentData.yearly['2025'].artists.map(a => a.name);
    console.log('    Current artists:', currentArtistNames);
    
    // Get working artist names
    const workingArtistNames = workingData.yearly['2025'].artists.map(a => a.name);
    console.log('    Working artists:', workingArtistNames);
    
    // Find missing artists
    const missingArtists = workingData.yearly['2025'].artists.filter(workingArtist => 
      !currentArtistNames.includes(workingArtist.name)
    );
    
    console.log('    Missing artists:', missingArtists.map(a => a.name));
    
    // Add missing artists to current data
    currentData.yearly['2025'].artists = [...currentData.yearly['2025'].artists, ...missingArtists];
    
    // Sort by plays (descending)
    currentData.yearly['2025'].artists.sort((a, b) => b.plays - a.plays);
    
    console.log(`    ✅ Added ${missingArtists.length} missing artists`);
  }
  
  // Merge albums
  if (currentData.yearly && currentData.yearly['2025'] && workingData.yearly && workingData.yearly['2025']) {
    console.log('  📊 Merging missing 2025 albums...');
    
    // Get current album names
    const currentAlbumNames = currentData.yearly['2025'].albums.map(a => a.name);
    console.log('    Current albums:', currentAlbumNames);
    
    // Get working album names
    const workingAlbumNames = workingData.yearly['2025'].albums.map(a => a.name);
    console.log('    Working albums:', workingAlbumNames);
    
    // Find missing albums
    const missingAlbums = workingData.yearly['2025'].albums.filter(workingAlbum => 
      !currentAlbumNames.includes(workingAlbum.name)
    );
    
    console.log('    Missing albums:', missingAlbums.map(a => a.name));
    
    // Add missing albums to current data
    currentData.yearly['2025'].albums = [...currentData.yearly['2025'].albums, ...missingAlbums];
    
    // Sort by plays (descending)
    currentData.yearly['2025'].albums.sort((a, b) => b.plays - a.plays);
    
    console.log(`    ✅ Added ${missingAlbums.length} missing albums`);
  }
  
  return currentData;
}

function main() {
  try {
    console.log('🎵 Starting missing 2025 items merge...');
    
    // Load current data
    const currentDataPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    console.log('📁 Loading current data...');
    const currentData = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));
    
    // Get working data from commit 8d021be
    console.log('📁 Loading working 2025 data from commit 8d021be...');
    const workingDataJson = execSync('git show 8d021be:tempo-trace-ai/public/data/spotify_enriched_data.json', { encoding: 'utf8' });
    const workingData = JSON.parse(workingDataJson);
    
    // Merge the missing items
    const mergedData = mergeMissing2025Items(currentData, workingData);
    
    // Update lastUpdated timestamp
    mergedData.lastUpdated = new Date().toISOString();
    
    // Save merged data
    console.log('💾 Saving merged data...');
    fs.writeFileSync(currentDataPath, JSON.stringify(mergedData, null, 2));
    
    console.log('✅ Missing 2025 items merge completed!');
    console.log('🎯 Added missing artists and albums from commit 8d021be');
    
  } catch (error) {
    console.error('❌ Error merging missing 2025 items:', error.message);
    process.exit(1);
  }
}

main();
