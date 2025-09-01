#!/usr/bin/env node

/**
 * Merge 2025 Working Spotify Data
 * 
 * This script takes the working 2025 enrichment data from commit ac1874d
 * and merges it with the current data, replacing null values with working Spotify data.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function merge2025Data(currentData, workingData) {
  console.log('🔄 Merging working 2025 Spotify data...');
  
  // Helper function to find matching item by name (with fuzzy matching)
  function findMatchingItem(items, targetName) {
    if (!items || !targetName) return null;
    
    // Exact match first
    let match = items.find(item => 
      item.name && item.name.toLowerCase().trim() === targetName.toLowerCase().trim()
    );
    
    if (match) return match;
    
    // Fuzzy match - try removing common suffixes/prefixes
    const cleanTarget = targetName.toLowerCase()
      .replace(/\s*\(.*?\)/g, '') // Remove (feat. ...) etc
      .replace(/\s*\[.*?\]/g, '') // Remove [explicit] etc
      .replace(/\s*feat\.?\s*/g, ' ') // Remove feat.
      .replace(/\s*ft\.?\s*/g, ' ') // Remove ft.
      .trim();
    
    match = items.find(item => {
      if (!item.name) return false;
      const cleanItem = item.name.toLowerCase()
        .replace(/\s*\(.*?\)/g, '')
        .replace(/\s*\[.*?\]/g, '')
        .replace(/\s*feat\.?\s*/g, ' ')
        .replace(/\s*ft\.?\s*/g, ' ')
        .trim();
      return cleanItem === cleanTarget;
    });
    
    return match;
  }
  
  // Helper function to merge item data
  function mergeItemData(currentItem, workingItem) {
    if (!workingItem) return currentItem;
    
    return {
      ...currentItem,
      spotifyData: currentItem.spotifyData || workingItem.spotifyData,
      image: currentItem.image || workingItem.image,
      spotifyUrl: currentItem.spotifyUrl || workingItem.spotifyUrl,
      artist: currentItem.artist || workingItem.artist,
      matchSource: currentItem.matchSource === 'none' ? workingItem.matchSource : currentItem.matchSource
    };
  }
  
  // Merge 2025 data only
  if (currentData.yearly && currentData.yearly['2025'] && workingData.yearly && workingData.yearly['2025']) {
    console.log('  📊 Merging 2025 artists...');
    if (currentData.yearly['2025'].artists && workingData.yearly['2025'].artists) {
      let mergedCount = 0;
      currentData.yearly['2025'].artists = currentData.yearly['2025'].artists.map(currentArtist => {
        const workingArtist = findMatchingItem(workingData.yearly['2025'].artists, currentArtist.name);
        const merged = mergeItemData(currentArtist, workingArtist);
        if (workingArtist && !currentArtist.spotifyData && merged.spotifyData) {
          mergedCount++;
        }
        return merged;
      });
      console.log(`    ✅ Merged ${mergedCount} 2025 artists`);
    }
    
    console.log('  📊 Merging 2025 tracks...');
    if (currentData.yearly['2025'].tracks && workingData.yearly['2025'].tracks) {
      let mergedCount = 0;
      currentData.yearly['2025'].tracks = currentData.yearly['2025'].tracks.map(currentTrack => {
        const workingTrack = findMatchingItem(workingData.yearly['2025'].tracks, currentTrack.name);
        const merged = mergeItemData(currentTrack, workingTrack);
        if (workingTrack && !currentTrack.spotifyData && merged.spotifyData) {
          mergedCount++;
        }
        return merged;
      });
      console.log(`    ✅ Merged ${mergedCount} 2025 tracks`);
    }
    
    console.log('  📊 Merging 2025 albums...');
    if (currentData.yearly['2025'].albums && workingData.yearly['2025'].albums) {
      let mergedCount = 0;
      currentData.yearly['2025'].albums = currentData.yearly['2025'].albums.map(currentAlbum => {
        const workingAlbum = findMatchingItem(workingData.yearly['2025'].albums, currentAlbum.name);
        const merged = mergeItemData(currentAlbum, workingAlbum);
        if (workingAlbum && !currentAlbum.spotifyData && merged.spotifyData) {
          mergedCount++;
        }
        return merged;
      });
      console.log(`    ✅ Merged ${mergedCount} 2025 albums`);
    }
  } else {
    console.log('  ⚠️  No 2025 data found in current or working data');
  }
  
  return currentData;
}

function main() {
  try {
    console.log('🎵 Starting 2025 Spotify data merge...');
    
    // Load current data
    const currentDataPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    console.log('📁 Loading current data...');
    const currentData = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));
    
    // Get working data from commit ac1874d
    console.log('📁 Loading working 2025 data from commit ac1874d...');
    const workingDataJson = execSync('git show ac1874d:tempo-trace-ai/public/data/spotify_enriched_data.json', { encoding: 'utf8' });
    const workingData = JSON.parse(workingDataJson);
    
    // Merge the 2025 data
    const mergedData = merge2025Data(currentData, workingData);
    
    // Update lastUpdated timestamp
    mergedData.lastUpdated = new Date().toISOString();
    
    // Save merged data
    console.log('💾 Saving merged data...');
    fs.writeFileSync(currentDataPath, JSON.stringify(mergedData, null, 2));
    
    console.log('✅ 2025 Spotify data merge completed!');
    console.log('🎯 2025 null values replaced with working Spotify data from commit ac1874d');
    
  } catch (error) {
    console.error('❌ Error merging 2025 Spotify data:', error.message);
    process.exit(1);
  }
}

main();
