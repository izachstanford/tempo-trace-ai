# 🎵 Enhanced Spotify Integration

A comprehensive system for enriching your music listening data with Spotify metadata, images, and links across all years and categories.

## 🚀 Features

### **Complete Data Coverage**
- **All Years**: Processes every year in your `annual_recaps.json`
- **All Categories**: Artists, tracks, and albums for each year
- **Lifetime Data**: Enhanced lifetime statistics with proper track+artist combinations
- **Accurate Matching**: Uses Spotify track URIs when available for precise matching
- **Smart Artist Correction**: Detects and corrects artist mismatches from raw URI data

### **Enhanced UI Components**
- **Clickable Cards**: Entire cards link to Spotify
- **Persistent Icons**: External link icons always visible
- **Rich Images**: Artist photos, album artwork, track covers
- **Progress Bars**: Visual play count indicators
- **Hover Effects**: Smooth animations and scaling

### **Automated Workflow**
- **One-Command Processing**: Complete pipeline from raw data to enriched UI
- **Music Data Processor Integration**: Automatically processes new streaming data
- **Error Handling**: Robust error handling and fallbacks
- **Progress Tracking**: Detailed logging and status updates

## 🏗️ Architecture

### **Data Flow**
```
Raw Streaming Data → Music Data Processor → Track+Artist Combinations → Raw Spotify Enrichment → Enhanced UI
```

### **File Structure**
```
tempo-trace-ai/
├── scripts/
│   ├── raw-spotify-fetcher.mjs         # Main enrichment script (uses raw URIs)
│   ├── process-and-enrich.mjs          # Complete workflow
│   ├── enhanced-spotify-fetcher.mjs    # Legacy enrichment script
│   └── fetch-spotify-data.mjs          # Legacy script (Pulse tab only)
├── src/components/
│   ├── EnhancedLeaderboardCard.jsx     # New Leaderboard component
│   ├── StaticEnhancedTopListCard.jsx   # Pulse tab component
│   └── LeaderboardTab.jsx              # Updated to use enhanced cards
└── public/data/
    └── spotify_enriched_data.json      # Comprehensive enriched data
```

## 📊 Data Structure

### **Enhanced Data Format**
```json
{
  "lifetime": {
    "artists": [...],
    "tracks": [...],
    "albums": [...],
    "lifetimeStats": {...}
  },
  "yearly": {
    "2016": {
      "artists": [...],
      "tracks": [...],
      "albums": [...],
      "yearStats": {...}
    },
    "2017": {...},
    // ... all years
  },
  "lastUpdated": "2025-01-01T00:00:00.000Z",
  "config": {
    "itemsPerCategory": 20,
    "apiDelay": 150
  }
}
```

### **Enriched Item Format**
```json
{
  "name": "Fall Out Boy",
  "plays": 1483,
  "spotifyData": {
    "external_urls": {"spotify": "https://open.spotify.com/artist/..."},
    "images": [{"url": "https://i.scdn.co/image/..."}],
    "genres": ["emo", "pop punk"],
    "popularity": 81
  },
  "image": "https://i.scdn.co/image/...",
  "spotifyUrl": "https://open.spotify.com/artist/...",
  "artist": "Fall Out Boy" // For tracks/albums
}
```

## 🛠️ Setup & Usage

### **Prerequisites**
1. **Spotify Developer Account**: Get API credentials
2. **Environment Variables**: Create `.env` file with:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   ```
   **Note**: The `.env` file is gitignored for security. You need to create it manually.
3. **Music Data**: Processed streaming data in `public/data/`

### **Music Data Processor Integration**
The system now properly integrates with the music-data-processor pipeline:

1. **Track+Artist Combinations**: The `generate_lifetime_stats.py` script now creates proper track+artist combinations instead of aggregating by track name only
2. **Filtered Data**: All existing filtering rules are respected (excludes Wakeem, pre-2016 data, etc.)
3. **Complete Pipeline**: The `process-and-enrich.mjs` script runs the complete music-data-processor pipeline before Spotify enrichment
4. **Accurate Statistics**: Play counts are now accurate for each unique track+artist combination

### **Setup Steps**
1. **Create `.env` file**:
   ```bash
   # In the tempo-trace-ai directory
   echo "SPOTIFY_CLIENT_ID=your_client_id" > .env
   echo "SPOTIFY_CLIENT_SECRET=your_client_secret" >> .env
   ```

2. **Get Spotify Credentials**:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Copy Client ID and Client Secret to `.env`

### **Quick Start**
```bash
# Complete workflow (recommended)
npm run process-and-enrich

# Or step by step:
npm run fetch-spotify-raw
```

### **Available Scripts**
- `npm run process-and-enrich` - Complete workflow (process + enrich)
- `npm run fetch-spotify-raw` - Raw Spotify enrichment (uses track+artist combinations)
- `npm run fetch-spotify-enhanced` - Legacy enrichment script
- `npm run fetch-spotify` - Legacy script (Pulse tab only)

## 🎯 Usage Scenarios

### **New Streaming Data**
When you get new Spotify/Apple Music data:
1. Place raw files in `music-data-processor/input/`
2. Run `npm run process-and-enrich`
3. All data is automatically processed and enriched

### **Update Existing Data**
To refresh Spotify metadata:
1. Run `npm run fetch-spotify-raw`
2. New metadata is fetched and cached with proper track+artist combinations

### **Development**
For local development:
1. Run `npm run dev`
2. Enhanced components automatically load enriched data
3. Fallback to basic display if enrichment fails

## 🔧 Configuration

### **Enhanced Fetcher Settings**
```javascript
const CONFIG = {
  ITEMS_PER_CATEGORY: 20,    // Items to fetch per category per year
  API_DELAY: 150,            // Rate limiting delay (ms)
  MAX_RETRIES: 3             // Retry attempts for failed requests
};
```

### **Component Behavior**
- **Loading States**: Skeleton loading while fetching data
- **Error Handling**: Graceful fallbacks for missing data
- **Image Fallbacks**: Default icons when images fail to load
- **Responsive Design**: Works on all screen sizes

## 🎨 UI Enhancements

### **Leaderboard Tab**
- **Year Selection**: Dropdown to switch between years
- **Enhanced Cards**: Clickable cards with images and links
- **Progress Bars**: Visual play count indicators
- **Artist Context**: Shows artist names for tracks/albums

### **Pulse Tab**
- **All-Time Stats**: Enhanced with Spotify data
- **Clickable Elements**: Direct links to Spotify
- **Persistent Icons**: Always-visible external link indicators

## 🔍 Data Accuracy

### **Track+Artist Combinations**
- **Proper Aggregation**: Uses track+artist combinations instead of track names only
- **Accurate Play Counts**: Prevents artificial inflation from combining different artists' songs
- **Filtered Data**: Respects all existing filtering rules (excludes Wakeem, etc.)

### **URI-Based Matching**
- **Track URIs**: Uses `spotify_track_uri` from raw data for exact matching
- **Artist Mismatch Detection**: Detects when raw URI points to wrong artist
- **Smart Correction**: Automatically searches for correct track+artist combination
- **Fallback Search**: Falls back to name-based search if URI unavailable

### **Error Handling**
- **API Failures**: Continues processing other items
- **Missing Data**: Graceful degradation to basic display
- **Rate Limiting**: Built-in delays to respect API limits

## 📈 Performance

### **Caching Strategy**
- **Static Data**: All enriched data cached in JSON file
- **No Runtime API Calls**: Frontend loads pre-fetched data
- **Efficient Loading**: Only loads data for visible years

### **API Usage**
- **Batch Processing**: Processes all years in single run
- **Rate Limiting**: 150ms delay between requests
- **Error Recovery**: Continues on individual failures

## 🚨 Troubleshooting

### **Common Issues**

**"No enriched data found"**
- Check if `spotify_enriched_data.json` exists
- Verify the file contains valid JSON
- Run `npm run fetch-spotify-enhanced` to regenerate

**"Spotify API errors"**
- Verify `.env` file has correct credentials
- Check API quota limits
- Ensure internet connection is stable

**"Images not loading"**
- Check browser console for CORS errors
- Verify image URLs are accessible
- Images have fallback icons

**"Missing artist context"**
- This is expected for some tracks/albums
- The system falls back to name-only display
- URI-based matching improves accuracy over time

### **Debug Mode**
Enable detailed logging by setting:
```bash
DEBUG=spotify-enrichment npm run fetch-spotify-enhanced
```

## 🔮 Future Enhancements

### **Planned Features**
- **Genre Analysis**: Use Spotify genres for categorization
- **Popularity Metrics**: Display Spotify popularity scores
- **Related Artists**: Show artist relationships
- **Playlist Integration**: Create Spotify playlists from top tracks

### **Performance Improvements**
- **Incremental Updates**: Only fetch new/changed items
- **Parallel Processing**: Concurrent API requests
- **Smart Caching**: Cache based on data freshness

## 🤝 Contributing

### **Adding New Features**
1. Extend the enriched data structure
2. Update the fetcher script
3. Modify UI components
4. Update documentation

### **Testing**
- Test with different data sets
- Verify API rate limiting
- Check error handling scenarios
- Validate UI responsiveness

---

**Created by [Zach Stanford](https://github.com/zachstanford)**  
🌟 This system transforms your music data into a rich, interactive experience!
