# 🎵 Spotify Integration Workflow

## 📋 **Simple, Standardized Process**

This document explains the **simplified, single-command workflow** for processing music data and enriching it with Spotify information.

## 🚀 **Quick Start**

### **For New Spotify Data Files:**

1. **Add your new Spotify data files** to:
   ```
   music-data-processor/input/Spotify Extended Streaming History/
   ```

2. **Run the complete workflow:**
   ```bash
   npm run process-and-enrich
   ```

3. **Start your app:**
   ```bash
   npm run dev
   ```

That's it! 🎉

## 📚 **Available Commands**

### **Core Commands:**
- `npm run process-music` - Process music data only (no Spotify)
- `npm run enrich-spotify` - Enrich existing data with Spotify info
- `npm run process-and-enrich` - Complete workflow (music + Spotify)

### **Development Commands:**
- `npm run dev` - Start development server
- `npm run build` - Build for production

## 🔧 **What Each Command Does**

### **`npm run process-music`**
1. Runs Python `music-data-processor` to analyze your streaming data
2. Generates lifetime stats and annual recaps
3. Copies processed data to `public/data/`

### **`npm run enrich-spotify`**
1. Reads raw Spotify streaming history files
2. Builds accurate track-to-artist mappings
3. Enriches data with Spotify images, links, and metadata
4. Outputs optimized JSON files (removes unnecessary fields)

### **`npm run process-and-enrich`**
1. Runs `process-music` first
2. Then runs `enrich-spotify`
3. Complete end-to-end workflow

## 📁 **Output Files**

After running the workflow, you'll have:

```
public/data/
├── lifetime_streaming_stats.json      # Core lifetime data
├── annual_recaps.json                 # Yearly breakdowns
├── consolidated_full_streaming_data_clean.json  # Raw processed data
├── spotify_enriched_data.json         # Combined Spotify data
├── spotify_enriched_lifetime.json     # Lifetime Spotify data
└── spotify_enriched_yearly.json       # Yearly Spotify data
```

## ⚙️ **Setup Requirements**

### **1. Environment Variables**
Create `.env` file with your Spotify API credentials:
```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

### **2. Spotify API Setup**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Copy Client ID and Client Secret to your `.env` file

## 🔄 **When to Re-run**

### **Run `npm run process-and-enrich` when:**
- ✅ You add new Spotify streaming history files
- ✅ You add new Apple Music data
- ✅ You want to refresh Spotify images/links
- ✅ You modify the music-data-processor logic

### **Run `npm run enrich-spotify` when:**
- ✅ You only want to refresh Spotify data (no new music files)
- ✅ Spotify images/links are outdated
- ✅ You want to update the enrichment logic

## 🐛 **Troubleshooting**

### **"SPOTIFY_CLIENT_ID not found"**
- Check your `.env` file exists and has correct credentials
- Verify Spotify app is active in developer dashboard

### **"Raw Spotify data directory not found"**
- This is normal if you don't have raw Spotify files
- The script will use search-only approach (less accurate)

### **"Processed data files not found"**
- Run `npm run process-music` first
- Check that `music-data-processor` completed successfully

## 📊 **Performance Notes**

- **File sizes optimized** - Removed `available_markets` field (92% size reduction)
- **Separate files** - Lifetime and yearly data split for faster loading
- **Rate limiting** - Built-in delays to respect Spotify API limits
- **Caching** - Access tokens cached to avoid repeated authentication

## 🎯 **Architecture Benefits**

### **Before (Overengineered):**
- ❌ 8 different Spotify fetcher scripts
- ❌ 8 npm scripts in package.json
- ❌ Complex, hard-to-understand workflow
- ❌ Multiple redundant approaches

### **After (Simplified):**
- ✅ 2 core scripts (`spotify-enricher.mjs`, `process-music-data.mjs`)
- ✅ 3 npm scripts (process-music, enrich-spotify, process-and-enrich)
- ✅ Single, clear workflow
- ✅ One standardized approach

## 🚀 **Ready to Use!**

Your Spotify integration is now **simple, maintainable, and powerful**. Just run `npm run process-and-enrich` whenever you have new data! 🎵
