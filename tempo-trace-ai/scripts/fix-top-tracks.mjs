import fs from 'fs';
import path from 'path';

// This script recalculates top tracks using track+artist combinations
// instead of just track names to avoid combining different artists' songs

function buildTrackArtistMap() {
  console.log('🔗 Building track+artist map from raw Spotify data...');
  
  const trackArtistMap = new Map(); // "track_name|artist_name" -> playCount
  const trackDetails = new Map(); // "track_name|artist_name" -> { track, artist, album, uri }
  
  // Read all raw Spotify files
  const spotifyDir = path.join(process.cwd(), '../music-data-processor/input/Spotify Extended Streaming History');
  
  if (!fs.existsSync(spotifyDir)) {
    console.log('⚠️  Raw Spotify data directory not found');
    return { trackArtistMap, trackDetails };
  }
  
  const files = fs.readdirSync(spotifyDir).filter(file => file.endsWith('.json'));
  console.log(`📁 Found ${files.length} Spotify files to process`);
  
  let totalRecords = 0;
  let uniqueTrackArtists = 0;
  
  files.forEach(file => {
    const filePath = path.join(spotifyDir, file);
    console.log(`📄 Processing ${file}...`);
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      data.forEach(record => {
        totalRecords++;
        
        if (record.master_metadata_track_name && 
            record.master_metadata_album_artist_name) {
          
          const trackName = record.master_metadata_track_name;
          const artistName = record.master_metadata_album_artist_name;
          const albumName = record.master_metadata_album_album_name;
          const trackUri = record.spotify_track_uri;
          
          // Create unique key combining track and artist
          const key = `${trackName}|${artistName}`;
          
          // Count plays
          trackArtistMap.set(key, (trackArtistMap.get(key) || 0) + 1);
          
          // Store details (only once per unique combination)
          if (!trackDetails.has(key)) {
            trackDetails.set(key, {
              track: trackName,
              artist: artistName,
              album: albumName,
              uri: trackUri
            });
            uniqueTrackArtists++;
          }
        }
      });
      
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });
  
  console.log(`📊 Processed ${totalRecords} raw Spotify records`);
  console.log(`🎵 Found ${uniqueTrackArtists} unique track+artist combinations`);
  
  return { trackArtistMap, trackDetails };
}

function recalculateTopTracks(trackArtistMap, trackDetails) {
  console.log('📊 Recalculating top tracks with proper track+artist combinations...');
  
  // Convert map to array and sort by play count
  const trackArtistArray = Array.from(trackArtistMap.entries())
    .map(([key, playCount]) => {
      const details = trackDetails.get(key);
      return {
        key,
        track: details.track,
        artist: details.artist,
        album: details.album,
        uri: details.uri,
        playCount
      };
    })
    .sort((a, b) => b.playCount - a.playCount);
  
  // Get top 20 track+artist combinations
  const topTrackArtists = trackArtistArray.slice(0, 20);
  
  console.log('\n🏆 Top Track+Artist Combinations:');
  topTrackArtists.forEach((item, index) => {
    console.log(`${index + 1}. "${item.track}" by ${item.artist} - ${item.playCount} plays`);
  });
  
  return topTrackArtists;
}

function updateLifetimeStats(topTrackArtists) {
  console.log('📝 Updating lifetime streaming stats...');
  
  const dataPath = path.join(process.cwd(), 'public/data/lifetime_streaming_stats.json');
  const lifetimeData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Update top_tracks with track+artist combinations
  const newTopTracks = topTrackArtists.map(item => [item.track, item.playCount]);
  
  // Also create a new field for track+artist details
  const topTrackArtistsDetailed = topTrackArtists.map(item => ({
    track: item.track,
    artist: item.artist,
    album: item.album,
    uri: item.uri,
    playCount: item.playCount
  }));
  
  lifetimeData.top_lists.top_tracks = newTopTracks;
  lifetimeData.top_lists.top_track_artists = topTrackArtistsDetailed;
  
  // Add metadata about the fix
  lifetimeData.metadata.track_artist_fix = {
    applied: true,
    timestamp: new Date().toISOString(),
    description: "Fixed top tracks to use track+artist combinations instead of track names only"
  };
  
  // Save updated data
  fs.writeFileSync(dataPath, JSON.stringify(lifetimeData, null, 2));
  
  console.log('✅ Updated lifetime_streaming_stats.json with corrected top tracks');
}

(async () => {
  try {
    console.log('🎵 Starting top tracks fix...');
    
    // Build track+artist map from raw data
    const { trackArtistMap, trackDetails } = buildTrackArtistMap();
    
    if (trackArtistMap.size === 0) {
      console.log('❌ No track data found');
      process.exit(1);
    }
    
    // Recalculate top tracks
    const topTrackArtists = recalculateTopTracks(trackArtistMap, trackDetails);
    
    // Update the lifetime stats file
    updateLifetimeStats(topTrackArtists);
    
    console.log('\n✅ Top tracks fix completed!');
    console.log('🔄 Now run the Spotify fetcher to get the correct mappings');
    
  } catch (error) {
    console.error('❌ Error fixing top tracks:', error.message);
    process.exit(1);
  }
})();
