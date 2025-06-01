# Stremio IMDb Episode Ratings

A comprehensive self-hosted Stremio add-on that displays **episode-specific** IMDb ratings using the complete IMDb dataset. Get accurate ratings for every episode with no API limits or missing data.

![Stremio Add-on](https://img.shields.io/badge/Stremio-Add--on-purple) ![Node.js](https://img.shields.io/badge/Node.js-16+-green) ![IMDb Dataset](https://img.shields.io/badge/IMDb-Complete%20Dataset-yellow) ![License](https://img.shields.io/badge/License-MIT-blue)

## 🎯 What This Does

Shows IMDb ratings directly in your Stremio streams list for both movies and TV episodes. Instead of switching tabs to check ratings, see them instantly alongside your streaming sources.

## ✨ Features

- 📺 **Episode-specific ratings** - See ratings for individual episodes, not just series averages
- 🎬 **Complete movie support** - Full IMDb coverage for films
- ⚡ **Lightning fast** - 5ms response times with local dataset
- 🚫 **No API limits** - Unlimited requests, no daily quotas
- 🔄 **Always current** - Auto-updates daily with fresh IMDb data
- 💾 **Self-hosted** - Runs entirely on your machine, no external dependencies

## 📊 What You'll See

The add-on appears as an informational stream showing:

```
───────────────
⭐ IMDb        : 9.3/10 (45,123 votes)
(Episode Rating)
───────────────
```

This appears right in your streams list alongside Torrentio and other sources.

## 🚀 Quick Start

### Prerequisites
- Node.js 16 or higher
- ~1GB RAM for dataset processing
- ~500MB free disk space

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/stremio-imdb-episode-ratings.git
cd stremio-imdb-episode-ratings
```

### 2. Start Ratings API (Terminal 1)
```bash
cd ratings-api
npm install
npm start
```

**First run downloads the complete IMDb dataset** (~15 minutes):
```
🚀 Comprehensive IMDb Ratings API running on http://localhost:3001
⏬ No data found. Starting comprehensive download...
📦 This downloads ~400MB and processes millions of records...
⏰ Estimated time: 10-15 minutes

📥 Downloading title.ratings.tsv...
📥 Downloading title.episode.tsv...
📊 Processing ratings dataset...
   Processed 100,000 ratings...
   Processed 500,000 ratings...
✅ Loaded 1,234,567 ratings

📺 Processing episodes dataset...
   Processed 50,000 episodes...
   Processed 500,000 episodes...
✅ Loaded 6,789,012 episode mappings

🎯 Ready to serve comprehensive ratings data!
```

### 3. Start Stremio Add-on (Terminal 2)
```bash
cd stremio-addon
npm install
npm start
```

### 4. Install in Stremio
1. Open Stremio
2. Click the puzzle piece icon (Add-ons)
3. Click "+" to install from URL
4. Enter: `http://localhost:3000/manifest.json`
5. Click "Install"

## 📁 Project Structure

```
stremio-imdb-episode-ratings/
├── ratings-api/              # Local IMDb dataset server
│   ├── ratings-api-server.js
│   ├── package.json
│   └── data/                 # Auto-created for dataset files
├── stremio-addon/            # Stremio add-on that calls the API
│   ├── index.js
│   └── package.json
└── README.md
```

## 🔧 How It Works

1. **Downloads IMDb datasets** - Gets the complete ratings and episode data directly from IMDb
2. **Processes into memory** - Builds fast lookup tables for instant access
3. **Serves local API** - Provides ratings via REST endpoints
4. **Stremio integration** - Add-on calls local API and displays ratings as streams

## ⚙️ Configuration

### Custom Ports
**Ratings API (default: 3001):**
```bash
PORT=8001 npm start
```

**Stremio Add-on (default: 3000):**
```bash
PORT=8000 RATINGS_API_URL=http://localhost:8001 npm start
```

### Environment Variables
```bash
# Optional: Set custom ratings API URL
export RATINGS_API_URL="http://localhost:3001"

# Optional: Set custom port for add-on
export PORT=3000
```

## 📈 Performance

| Metric | Value |
|--------|-------|
| **Initial Setup** | ~15 minutes (one time) |
| **Memory Usage** | ~500MB (dataset in RAM) |
| **Response Time** | ~5ms per request |
| **Dataset Size** | ~400MB download (auto-cleaned) |
| **Updates** | Daily at 2 AM (automatic) |

## 🛠️ Troubleshooting

**Download taking too long?**
- Normal for first run - processing millions of records
- Check internet connection
- IMDb servers occasionally slow - just wait it out

**High memory usage?**
- Expected! Complete dataset kept in RAM for speed
- ~500MB is normal for millions of ratings

**No ratings showing in Stremio?**
- Check ratings API is running: http://localhost:3001/health
- Verify add-on installed correctly
- Look for "📊 IMDb Rating" in your streams list

**Episode shows series rating instead?**
- Some episodes don't have individual ratings on IMDb
- Automatic fallback to series rating
- Look for "(Episode Rating)" vs "(Series Rating)" label

## 🔄 Updates

The system automatically downloads fresh IMDb data every day at 2 AM. Manual updates can be triggered by restarting the ratings API.

**Force update:**
```bash
# Stop ratings API (Ctrl+C) then restart
cd ratings-api
npm start
```

## 🌐 Public Deployment

To share with others, deploy both services to cloud hosting:

1. **Deploy ratings API** to Heroku/Railway/VPS
2. **Deploy Stremio add-on** with `RATINGS_API_URL` pointing to your API
3. **Share add-on URL** with others

## 🤝 Contributing

Pull requests welcome! Some ideas:

- Add more rating sources (Rotten Tomatoes, Metacritic)
- Implement Redis caching for better performance
- Create Docker containers for easier deployment
- Add web interface for browsing ratings
- Support for additional metadata

## 📄 License

MIT License - Use freely for personal or commercial projects!


**Perfect for anyone who wants complete IMDb rating data without the limitations of third-party APIs!**
