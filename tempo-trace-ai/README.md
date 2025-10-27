# 🎵 TempoTraceAI

**AI-powered music listening insights dashboard** that analyzes your streaming data from Spotify and Apple Music to provide beautiful visualizations and insights about your musical journey.

🌐 **Live Site:** [https://aiwithzach.com/tempo-trace-ai/](https://aiwithzach.com/tempo-trace-ai/)

## 🚀 **Quick Start**

### **Development**
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`

### **Adding New Spotify Data**
```bash
# 1. Add your new Spotify files to music-data-processor/input/
# 2. Process and enrich data
npm run process-and-enrich

# 3. Consolidate data files
npm run consolidate-data

# 4. Test locally
npm run dev
```

### **Deployment to Live Site**
```bash
# 1. Build and deploy to website
npm run build
./deploy.sh

# 2. Build main website
cd /Users/zachstanford/Development/website-ai-with-zach/
npm run build

# 3. Deploy to production
git add .
git commit -m "Update tempo-trace-ai"
git push origin main
```

## 📚 **Documentation**

For detailed information, see the [docs folder](../docs/):

- **[🚀 Deployment Guide](../docs/DEPLOYMENT_EXPLAINED.md)** - Complete deployment workflow
- **[🎵 Spotify Workflow](../docs/SPOTIFY_WORKFLOW.md)** - Adding new Spotify data
- **[📊 Data Optimization](../docs/DATA_OPTIMIZATION.md)** - Optimized data structure
- **[🔧 Technical Docs](../docs/README.md)** - Complete documentation index

## 🛠 **Available Scripts**

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run process-music` - Process music data only
- `npm run enrich-spotify` - **Incremental** Spotify enrichment (fast!)
- `npm run enrich-spotify-full` - Full Spotify enrichment (slow, re-fetches everything)
- `npm run process-and-enrich` - Complete workflow (music + incremental Spotify)

## 🏗 **Architecture**

- **Frontend:** React + Vite + Tailwind CSS
- **Data Processing:** Python music-data-processor pipeline
- **Spotify Integration:** Node.js scripts with Spotify Web API
- **Deployment:** Automated deployment to [aiwithzach.com](https://aiwithzach.com)

## 📊 **Features**

- **The Pulse** - Lifetime listening statistics with Spotify integration
- **Leaderboard** - Yearly breakdowns with historical data
- **Concert Compass** - Concert attendance tracking and analysis
- **Advanced Insights** - Deep analytics and visualizations

## 🎯 **Project Status**

✅ **Complete Spotify Integration** - Full enrichment for all years (2016-2025)  
✅ **Incremental Enrichment** - Only updates missing data (fast & efficient!)  
✅ **Optimized Data Structure** - 3 consolidated files instead of 7 separate files  
✅ **Simplified Workflow** - Single-command processes for common tasks  
✅ **Clean Deployment** - Automated deployment to live website  
✅ **Comprehensive Documentation** - Complete guides for all workflows  

## 🔗 **Related Projects**

- **[website-ai-with-zach](https://github.com/izachstanford/website-ai-with-zach)** - Main website repository
- **[music-data-processor](../music-data-processor/)** - Python data processing pipeline

---

**Built with AI by [Zach Stanford](https://aiwithzach.com)**