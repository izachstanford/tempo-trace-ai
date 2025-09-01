#!/usr/bin/env node

/**
 * Merge Working Spotify Data
 * 
 * This script takes the working enrichment data from commit 6dca3c4
 * and merges it with the current data, replacing null values with
 * working Spotify data to bypass rate limits.
 */

import fs from 'fs';
import path from 'path';

function mergeEnrichedData(currentData, workingData) {
  console.log('🔄 Merging working Spotify data...');
  
  // Helper function to find matching item by name
  function findMatchingItem(items, targetName) {
    return items.find(item => 
      item.name && targetName && 
      item.name.toLowerCase().trim() === targetName.toLowerCase().trim()
    );
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
      currentData.lifetime.artists = currentData.lifetime.artists.map(currentArtist => {
        const workingArtist = findMatchingItem(workingData.lifetime.artists, currentArtist.name);
        return mergeItemData(currentArtist, workingArtist);
      });
    }
    
    console.log('  📊 Merging lifetime tracks...');
    if (currentData.lifetime.tracks && workingData.lifetime.tracks) {
      currentData.lifetime.tracks = currentData.lifetime.tracks.map(currentTrack => {
        const workingTrack = findMatchingItem(workingData.lifetime.tracks, currentTrack.name);
        return mergeItemData(currentTrack, workingTrack);
      });
    }
    
    console.log('  📊 Merging lifetime albums...');
    if (currentData.lifetime.albums && workingData.lifetime.albums) {
      currentData.lifetime.albums = currentData.lifetime.albums.map(currentAlbum => {
        const workingAlbum = findMatchingItem(workingData.lifetime.albums, currentAlbum.name);
        return mergeItemData(currentAlbum, workingAlbum);
      });
    }
  }
  
  // Merge yearly data
  if (currentData.yearly && workingData.yearly) {
    console.log('  📅 Merging yearly data...');
    
    for (const year in currentData.yearly) {
      if (workingData.yearly[year]) {
        console.log(`    📊 Merging ${year} data...`);
        
        // Merge artists
        if (currentData.yearly[year].artists && workingData.yearly[year].artists) {
          currentData.yearly[year].artists = currentData.yearly[year].artists.map(currentArtist => {
            const workingArtist = findMatchingItem(workingData.yearly[year].artists, currentArtist.name);
            return mergeItemData(currentArtist, workingArtist);
          });
        }
        
        // Merge tracks
        if (currentData.yearly[year].tracks && workingData.yearly[year].tracks) {
          currentData.yearly[year].tracks = currentData.yearly[year].tracks.map(currentTrack => {
            const workingTrack = findMatchingItem(workingData.yearly[year].tracks, currentTrack.name);
            return mergeItemData(currentTrack, workingTrack);
          });
        }
        
        // Merge albums
        if (currentData.yearly[year].albums && workingData.yearly[year].albums) {
          currentData.yearly[year].albums = currentData.yearly[year].albums.map(currentAlbum => {
            const workingAlbum = findMatchingItem(workingData.yearly[year].albums, currentAlbum.name);
            return mergeItemData(currentAlbum, workingAlbum);
          });
        }
      }
    }
  }
  
  return currentData;
}

function main() {
  try {
    console.log('🎵 Starting Spotify data merge...');
    
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
    
    console.log('✅ Spotify data merge completed!');
    console.log('🎯 Null values replaced with working Spotify data from commit 6dca3c4');
    
  } catch (error) {
    console.error('❌ Error merging Spotify data:', error.message);
    process.exit(1);
  }
}

main();
