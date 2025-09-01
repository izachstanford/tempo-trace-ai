# 🚀 Deployment Process Explained

> **📚 For more detailed technical information, see the [complete documentation index](README.md)**

## 📁 **Data File Structure**

### **Why You Had Files in Both Folders:**

1. **`public/data/`** - **Development Data** (Source of Truth)
   - Contains the source data files for development
   - Used by `npm run dev` (development server)
   - These are the files you edit and maintain

2. **`dist/data/`** - **Built Data** (Generated)
   - Created when you run `npm run build`
   - Vite automatically copies `public/data/` → `dist/data/` during build
   - This is what gets deployed to your live website

## 🔄 **Complete Deployment Workflow**

### **Step 1: Development**
```bash
# In tempo-trace-ai/tempo-trace-ai/
npm run dev  # Uses public/data/ files
```
- Edit your data files in `public/data/`
- Test changes locally at `http://localhost:3000`

### **Step 2: Build**
```bash
# In tempo-trace-ai/tempo-trace-ai/
npm run build  # Copies public/data/ → dist/data/
```
- Vite builds the React app
- Copies `public/data/` → `dist/data/`
- Creates optimized assets in `dist/assets/`

### **Step 3: Deploy to Website**
```bash
# In tempo-trace-ai/tempo-trace-ai/
./deploy.sh  # Copies dist/ → website-ai-with-zach/public/tempo-trace-ai/
```
- Copies `dist/index.html` → `website-ai-with-zach/public/tempo-trace-ai/index.html`
- Copies `dist/assets/` → `website-ai-with-zach/public/tempo-trace-ai/assets/`
- Copies `dist/data/` → `website-ai-with-zach/public/tempo-trace-ai/data/`
- Copies `dist/favicon.svg` → `website-ai-with-zach/public/tempo-trace-ai/favicon.svg`

### **Step 4: Build Main Website**
```bash
# In website-ai-with-zach/
npm run build  # Builds the main Astro site including tempo-trace-ai
```
- Astro builds the main website
- Includes the tempo-trace-ai app at `/tempo-trace-ai/`
- Creates final `dist/` folder for deployment

### **Step 5: Deploy to Production**
```bash
# In website-ai-with-zach/
git add .
git commit -m "Update tempo-trace-ai"
git push origin main
```
- Netlify automatically deploys from GitHub
- Live at `https://aiwithzach.com/tempo-trace-ai/`

## 📊 **Current Optimized Data Files**

### **In `public/data/` (Development):**
- `lifetime_streaming_stats.json` (30KB) - Core lifetime data
- `annual_recaps.json` (142KB) - Yearly breakdowns
- `spotify_enriched_data.json` (213KB) - Combined Spotify enrichment data
- `artist_summary.json` (9.2MB) - Artist analytics
- `concerts.json` (5.6KB) - Concert data

### **In `dist/data/` (Built):**
- Same files as `public/data/` (automatically copied by Vite)

### **In `website-ai-with-zach/public/tempo-trace-ai/data/` (Deployed):**
- Same files as `dist/data/` (copied by deploy.sh)

## 🧹 **Cleanup Completed**

### **Current Data Files:**
- ✅ `lifetime_streaming_stats.json` - Core lifetime data
- ✅ `annual_recaps.json` - Yearly breakdowns
- ✅ `spotify_enriched_data.json` - Combined Spotify enrichment data
- ✅ `artist_summary.json` - Artist analytics
- ✅ `concerts.json` - Concert data

### **Result:**
- ✅ **5 separate files** with clear purposes
- ✅ **Simple, reliable structure**
- ✅ **Easy to debug and maintain**

## 🎯 **For Adding New Spotify Data**

### **Complete Workflow:**
```bash
# 1. Add new Spotify files to music-data-processor
# 2. Process and enrich data
npm run process-and-enrich

# 3. Consolidate data files
npm run consolidate-data

# 4. Test locally
npm run dev

# 5. Build and deploy
npm run build
./deploy.sh

# 6. Build main website
cd /Users/zachstanford/Development/website-ai-with-zach/
npm run build

# 7. Deploy to production
git add .
git commit -m "Update tempo-trace-ai with new data"
git push origin main
```

## 🌐 **Final URLs**

- **Development**: `http://localhost:3000` (tempo-trace-ai dev server)
- **Local Testing**: `http://localhost:4322/tempo-trace-ai/` (Astro preview)
- **Production**: `https://aiwithzach.com/tempo-trace-ai/` (live site)

## 📝 **Key Points**

1. **`public/data/`** is your source of truth - edit files here
2. **`dist/data/`** is automatically generated - don't edit directly
3. **Deploy script** copies from `dist/` to the main website
4. **Main website** must be rebuilt after tempo-trace-ai deployment
5. **Netlify** automatically deploys the main website to production

## 🎉 **Result**

Your deployment process is now **clean, optimized, and well-documented**! The data structure is simplified, and the deployment workflow is clear and efficient. 🚀
