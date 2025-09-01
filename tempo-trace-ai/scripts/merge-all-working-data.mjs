#!/usr/bin/env node

/**
 * Merge All Working Spotify Data
 * 
 * This script takes the working enrichment data from commit 6dca3c4
 * and merges it with the current data for ALL years and ALL categories,
 * replacing null values with working Spotify data to bypass rate limits.
 */

import fs from 'fs';
import path from 'path';

function mergeEnrichedData(currentData, workingData) {
  console.log('🔄 Merging working Spotify data for ALL years and categories...');
  
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
  
  // Merge lifetime data
  if (currentData.lifetime && workingData.lifetime) {
    console.log('  📊 Merging lifetime artists...');
    if (currentData.lifetime.artists && workingData.lifetime.artists) {
      let mergedCount = 0;
      currentData.lifetime.artists = currentData.lifetime.artists.map(currentArtist => {
        const workingArtist = findMatchingItem(workingData.lifetime.artists, currentArtist.name);
        const merged = mergeItemData(currentArtist, workingArtist);
        if (workingArtist && !currentArtist.spotifyData && merged.spotifyData) {
          mergedCount++;
        }
        return merged;
      });
      console.log(`    ✅ Merged ${mergedCount} lifetime artists`);
    }
    
    console.log('  📊 Merging lifetime tracks...');
    if (currentData.lifetime.tracks && workingData.lifetime.tracks) {
      let mergedCount = 0;
      currentData.lifetime.tracks = currentData.lifetime.tracks.map(currentTrack => {
        const workingTrack = findMatchingItem(workingData.lifetime.tracks, currentTrack.name);
        const merged = mergeItemData(currentTrack, workingTrack);
        if (workingTrack && !currentTrack.spotifyData && merged.spotifyData) {
          mergedCount++;
        }
        return merged;
      });
      console.log(`    ✅ Merged ${mergedCount} lifetime tracks`);
    }
    
    console.log('  📊 Merging lifetime albums...');
    if (currentData.lifetime.albums && workingData.lifetime.albums) {
      let mergedCount = 0;
      currentData.lifetime.albums = currentData.lifetime.albums.map(currentAlbum => {
        const workingAlbum = findMatchingItem(workingData.lifetime.albums, currentAlbum.name);
        const merged = mergeItemData(currentAlbum, workingAlbum);
        if (workingAlbum && !currentAlbum.spotifyData && merged.spotifyData) {
          mergedCount++;
        }
        return merged;
      });
      console.log(`    ✅ Merged ${mergedCount} lifetime albums`);
    }
  }
  
  // Merge yearly data for ALL years
  if (currentData.yearly && workingData.yearly) {
    console.log('  📅 Merging yearly data for all years...');
    
    const currentYears = Object.keys(currentData.yearly).sort();
    const workingYears = Object.keys(workingData.yearly).sort();
    
    console.log(`    📊 Current years: ${currentYears.join(', ')}`);
    console.log(`    📊 Working years: ${workingYears.join(', ')}`);
    
    for (const year of currentYears) {
      if (workingData.yearly[year]) {
        console.log(`    📊 Merging ${year} data...`);
        
        // Merge artists
        if (currentData.yearly[year].artists && workingData.yearly[year].artists) {
          let mergedCount = 0;
          currentData.yearly[year].artists = currentData.yearly[year].artists.map(currentArtist => {
            const workingArtist = findMatchingItem(workingData.yearly[year].artists, currentArtist.name);
            const merged = mergeItemData(currentArtist, workingArtist);
            if (workingArtist && !currentArtist.spotifyData && merged.spotifyData) {
              mergedCount++;
            }
            return merged;
          });
          console.log(`      ✅ Merged ${mergedCount} ${year} artists`);
        }
        
        // Merge tracks
        if (currentData.yearly[year].tracks && workingData.yearly[year].tracks) {
          let mergedCount = 0;
          currentData.yearly[year].tracks = currentData.yearly[year].tracks.map(currentTrack => {
            const workingTrack = findMatchingItem(workingData.yearly[year].tracks, currentTrack.name);
            const merged = mergeItemData(currentTrack, workingTrack);
            if (workingTrack && !currentTrack.spotifyData && merged.spotifyData) {
              mergedCount++;
            }
            return merged;
          });
          console.log(`      ✅ Merged ${mergedCount} ${year} tracks`);
        }
        
        // Merge albums
        if (currentData.yearly[year].albums && workingData.yearly[year].albums) {
          let mergedCount = 0;
          currentData.yearly[year].albums = currentData.yearly[year].albums.map(currentAlbum => {
            const workingAlbum = findMatchingItem(workingData.yearly[year].albums, currentAlbum.name);
            const merged = mergeItemData(currentAlbum, workingAlbum);
            if (workingAlbum && !currentAlbum.spotifyData && merged.spotifyData) {
              mergedCount++;
            }
            return merged;
          });
          console.log(`      ✅ Merged ${mergedCount} ${year} albums`);
        }
      } else {
        console.log(`    ⚠️  No working data found for ${year}`);
      }
    }
  }
  
  return currentData;
}

function main() {
  try {
    console.log('🎵 Starting comprehensive Spotify data merge...');
    
    // Load current data
    const currentDataPath = path.join(process.cwd(), 'public/data/spotify_enriched_data.json');
    console.log('📁 Loading current data...');
    const currentData = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));
    
    // Load working data from commit 6dca3c4
    const workingDataPath = '/tmp/working_enriched_data.json';
    console.log('📁 Loading working data from commit 6dca3c4...');
    const workingData = JSON.parse(fs.readFileSync(workingDataPath, 'utf8'));
    
    // Merge the data
    const mergedData = mergeEnrichedData(currentData, workingData);
    
    // Update lastUpdated timestamp
    mergedData.lastUpdated = new Date().toISOString();
    
    // Save merged data
    console.log('💾 Saving merged data...');
    fs.writeFileSync(currentDataPath, JSON.stringify(mergedData, null, 2));
    
    console.log('✅ Comprehensive Spotify data merge completed!');
    console.log('🎯 All null values replaced with working Spotify data from commit 6dca3c4');
    console.log('📊 Covers all years and all categories (artists, tracks, albums)');
    
  } catch (error) {
    console.error('❌ Error merging Spotify data:', error.message);
    process.exit(1);
  }
}

main();
