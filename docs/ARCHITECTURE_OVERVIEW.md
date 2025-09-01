# 🏗️ TempoTraceAI Architecture Overview

> **📚 This is the comprehensive technical overview. For quick start guides, see [Spotify Workflow](SPOTIFY_WORKFLOW.md) and [Deployment Guide](DEPLOYMENT_EXPLAINED.md)**

## 🎯 **Project Overview**

TempoTraceAI is a React-based web application that analyzes music streaming data to provide insights and visualizations. It integrates with Spotify's API to enrich data with images, links, and metadata.

## 🏛️ **System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    TempoTraceAI System                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + Vite)                                   │
│  ├── Components (UI)                                       │
│  ├── Hooks (Data Management)                               │
│  └── Static Data Files                                     │
├─────────────────────────────────────────────────────────────┤
│  Data Processing Pipeline                                  │
│  ├── Python Scripts (music-data-processor)                │
│  ├── Node.js Scripts (Spotify Integration)                │
│  └── Data Consolidation                                    │
├─────────────────────────────────────────────────────────────┤
│  External APIs                                             │
│  ├── Spotify Web API                                       │
│  └── Raw Streaming Data Files                              │
└─────────────────────────────────────────────────────────────┘
```

## 📁 **Repository Structure**

```
tempo-trace-ai/
├── tempo-trace-ai/                    # Main React application
│   ├── src/                          # Source code
│   │   ├── components/               # React components
│   │   ├── hooks/                    # Custom React hooks
│   │   └── styles/                   # CSS and styling
│   ├── public/data/                  # Development data files
│   ├── scripts/                      # Node.js automation scripts
│   ├── docs/                         # Documentation
│   └── deploy.sh                     # Deployment script
├── music-data-processor/              # Python data processing
│   ├── scripts/                      # Python processing scripts
│   ├── input/                        # Raw streaming data
│   └── output/                       # Processed data
└── docs/                             # Comprehensive documentation
```

## 🔄 **Data Flow**

### **1. Raw Data Input**
- Spotify streaming history JSON files
- Apple Music CSV exports
- Concert attendance data

### **2. Data Processing**
```bash
# Python processing
python wrapped_reimagined.py

# Outputs:
# - lifetime_streaming_stats.json
# - annual_recaps.json
# - consolidated_full_streaming_data_clean.json
```

### **3. Spotify Enrichment**
```bash
# Node.js enrichment
npm run enrich-spotify

# Outputs:
# - spotify_enriched_lifetime.json
# - spotify_enriched_yearly.json
```

### **4. Data Consolidation**
```bash
# Consolidate into optimized files
npm run consolidate-data

# Outputs:
# - lifetime_data.json (Pulse tab)
# - yearly_data.json (Leaderboard tab)
# - concert_data.json (Concert Compass tab)
```

### **5. Frontend Consumption**
- React components load consolidated data files
- Static JSON files served by Vite
- No direct API calls from frontend

## 🎨 **Frontend Architecture**

### **Component Structure**
```
src/
├── components/
│   ├── StaticEnhancedTopListCard.jsx    # Pulse tab items
│   ├── EnhancedLeaderboardCard.jsx      # Leaderboard items
│   ├── PulseTab.jsx                     # Lifetime statistics
│   ├── LeaderboardTab.jsx               # Yearly breakdowns
│   ├── ConcertCompassTab.jsx            # Concert analysis
│   └── charts/                          # Visualization components
├── hooks/
│   └── useData.js                       # Data loading hook
└── App.jsx                              # Main application
```

### **Data Loading Pattern**
```javascript
// useData.js - Centralized data loading
const { lifetimeData, yearlyData, concertData } = useData();

// Components consume specific data
<StaticEnhancedTopListCard data={lifetimeData} />
<EnhancedLeaderboardCard data={yearlyData} />
```

## 🔧 **Build & Deployment Pipeline**

### **Development**
```bash
npm run dev  # Uses public/data/ files
```

### **Production Build**
```bash
npm run build  # Copies public/data/ → dist/data/
```

### **Deployment**
```bash
./deploy.sh  # Copies dist/ → website-ai-with-zach/public/tempo-trace-ai/
```

### **Final Deployment**
```bash
# In website-ai-with-zach/
npm run build  # Builds Astro site
git push origin main  # Netlify auto-deploys
```

## 📊 **Data Architecture**

### **Optimized Data Structure**
- **3 consolidated files** instead of 7 separate files
- **Single source of truth** per use case
- **No redundant data** across files
- **Optimized file sizes** (removed unnecessary fields)

### **File Purposes**
- `lifetime_data.json` - Pulse tab (lifetime stats + Spotify enrichment)
- `yearly_data.json` - Leaderboard tab (annual data + Spotify enrichment)
- `concert_data.json` - Concert Compass tab (artist data + concert data)

## 🔌 **Spotify Integration**

### **Authentication**
- Client Credentials Flow
- Environment variables for API keys
- Token caching and refresh

### **Data Enrichment**
- Track-to-artist mapping from raw data
- URI-based lookups for accuracy
- Fallback to search API
- Data cleaning and optimization

### **Rate Limiting**
- Built-in delays between requests
- Token caching
- Error handling and retries

## 🚀 **Performance Optimizations**

### **Frontend**
- Static data files (no API calls)
- Optimized bundle sizes
- Lazy loading where appropriate
- Efficient data structures

### **Data**
- Consolidated files (fewer network requests)
- Removed unnecessary fields (92% size reduction)
- Separate files per use case
- Gzipped delivery

### **Build Process**
- Vite for fast builds
- Tree shaking
- Code splitting
- Asset optimization

## 🔒 **Security Considerations**

### **API Keys**
- Environment variables only
- No keys in frontend code
- Local development only

### **Data Privacy**
- Personal data stays local
- No data sent to external services
- Static file serving only

## 📈 **Scalability**

### **Current Limitations**
- Static data files (manual updates)
- Single-user design
- Local processing only

### **Future Considerations**
- Database integration
- Multi-user support
- Real-time data processing
- Cloud deployment

## 🧪 **Testing Strategy**

### **Current Testing**
- Manual testing of workflows
- Data validation scripts
- Build process verification

### **Recommended Additions**
- Unit tests for components
- Integration tests for data flow
- End-to-end testing
- Performance monitoring

## 📚 **Documentation Structure**

- **[README.md](README.md)** - Documentation index
- **[Spotify Workflow](SPOTIFY_WORKFLOW.md)** - Quick start guide
- **[Deployment Guide](DEPLOYMENT_EXPLAINED.md)** - Deployment process
- **[Data Optimization](DATA_OPTIMIZATION.md)** - Performance improvements
- **[Music Data Processor Integration](MUSIC_DATA_PROCESSOR_INTEGRATION.md)** - Python pipeline
- **[Enhanced Spotify Integration](ENHANCED_SPOTIFY_INTEGRATION.md)** - Advanced features

## 🎯 **Key Design Decisions**

### **Static Data Approach**
- **Why:** Simplicity, performance, security
- **Trade-off:** Manual updates required

### **Consolidated Files**
- **Why:** Fewer requests, better performance
- **Trade-off:** Larger individual files

### **Local Processing**
- **Why:** Privacy, control, no external dependencies
- **Trade-off:** Manual workflow

### **React + Vite**
- **Why:** Modern tooling, fast development
- **Trade-off:** Learning curve

## 🔮 **Future Roadmap**

### **Short Term**
- Automated data processing
- Better error handling
- Performance monitoring

### **Long Term**
- Real-time data updates
- Multi-platform support
- Advanced analytics
- Social features

---

**This architecture prioritizes simplicity, performance, and maintainability while providing a rich user experience for music data analysis.**
