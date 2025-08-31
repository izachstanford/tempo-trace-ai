// Simple test script to verify Spotify integration
import spotifyService from './src/services/spotifyService.js';

async function testSpotifyIntegration() {
  console.log('Testing Spotify integration...');
  
  try {
    // Test artist search
    console.log('\n1. Testing artist search...');
    const artist = await spotifyService.searchArtist('Fall Out Boy');
    console.log('Artist result:', artist ? {
      name: artist.name,
      image: artist.images?.[0]?.url,
      spotifyUrl: artist.external_urls?.spotify
    } : 'No artist found');

    // Test track search
    console.log('\n2. Testing track search...');
    const track = await spotifyService.searchTrack('High Hopes', 'Panic! At The Disco');
    console.log('Track result:', track ? {
      name: track.name,
      artist: track.artists?.[0]?.name,
      image: track.album?.images?.[0]?.url,
      spotifyUrl: track.external_urls?.spotify
    } : 'No track found');

    // Test album search
    console.log('\n3. Testing album search...');
    const album = await spotifyService.searchAlbum('Clancy', 'Twenty One Pilots');
    console.log('Album result:', album ? {
      name: album.name,
      artist: album.artists?.[0]?.name,
      image: album.images?.[0]?.url,
      spotifyUrl: album.external_urls?.spotify
    } : 'No album found');

    console.log('\n✅ Spotify integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Spotify integration test failed:', error.message);
  }
}

testSpotifyIntegration();
