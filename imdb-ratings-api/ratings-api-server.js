const express = require('express');
const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const zlib = require('zlib');
const cron = require('node-cron');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// In-memory caches
let ratingsCache = {}; // IMDb ratings
let episodeCache = {}; // Episode mappings: series:season:episode -> episode_imdb_id
let lastUpdated = null;
let ratingsCount = 0;
let episodesCount = 0;

// Function to download and extract a gzipped TSV file
async function downloadAndExtract(url, filename) {
    console.log(`📥 Downloading ${filename}...`);
    
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }
    
    const gzipFilePath = path.join(dataDir, `${filename}.gz`);
    const tsvFilePath = path.join(dataDir, filename);
    
    // Download
    const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream'
    });
    
    const fileWriter = fs.createWriteStream(gzipFilePath);
    response.data.pipe(fileWriter);
    
    await new Promise((resolve, reject) => {
        fileWriter.on('finish', resolve);
        fileWriter.on('error', reject);
    });
    
    console.log(`🗜️  Extracting ${filename}...`);
    
    // Extract
    const fileStream = fs.createReadStream(gzipFilePath);
    const unzipStream = zlib.createGunzip();
    const outputStream = fs.createWriteStream(tsvFilePath);
    
    fileStream.pipe(unzipStream).pipe(outputStream);
    
    await new Promise((resolve, reject) => {
        outputStream.on('finish', resolve);
        outputStream.on('error', reject);
    });
    
    // Clean up compressed file
    fs.unlinkSync(gzipFilePath);
    
    return tsvFilePath;
}

// Process the ratings dataset
async function processRatings(filePath) {
    console.log('📊 Processing ratings dataset...');
    
    const newRatingsCache = {};
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });
    
    let headerSkipped = false;
    let processedLines = 0;
    
    for await (const line of rl) {
        if (!headerSkipped) {
            headerSkipped = true;
            continue;
        }
        
        const [tconst, averageRating, numVotes] = line.split('\t');
        if (tconst && averageRating && averageRating !== 'N/A') {
            newRatingsCache[tconst] = {
                rating: parseFloat(averageRating).toFixed(1),
                votes: numVotes || '0'
            };
            processedLines++;
            
            if (processedLines % 100000 === 0) {
                console.log(`   Processed ${processedLines.toLocaleString()} ratings...`);
            }
        }
    }
    
    ratingsCache = newRatingsCache;
    ratingsCount = Object.keys(newRatingsCache).length;
    
    console.log(`✅ Loaded ${ratingsCount.toLocaleString()} ratings`);
    
    // Clean up file
    fs.unlinkSync(filePath);
}

// Process the episodes dataset
async function processEpisodes(filePath) {
    console.log('📺 Processing episodes dataset...');
    
    const newEpisodeCache = {};
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });
    
    let headerSkipped = false;
    let processedLines = 0;
    
    for await (const line of rl) {
        if (!headerSkipped) {
            headerSkipped = true;
            continue;
        }
        
        // Format: tconst, parentTconst, seasonNumber, episodeNumber
        const [episodeId, seriesId, seasonNum, episodeNum] = line.split('\t');
        
        if (episodeId && seriesId && seasonNum && episodeNum && 
            seasonNum !== '\\N' && episodeNum !== '\\N') {
            
            const key = `${seriesId}:${seasonNum}:${episodeNum}`;
            newEpisodeCache[key] = episodeId;
            processedLines++;
            
            if (processedLines % 50000 === 0) {
                console.log(`   Processed ${processedLines.toLocaleString()} episodes...`);
            }
        }
    }
    
    episodeCache = newEpisodeCache;
    episodesCount = Object.keys(newEpisodeCache).length;
    
    console.log(`✅ Loaded ${episodesCount.toLocaleString()} episode mappings`);
    
    // Clean up file
    fs.unlinkSync(filePath);
}

// Main function to download and process all datasets
async function downloadAndProcessAllData() {
    console.log('🚀 Starting comprehensive IMDb data download...');
    console.log('⚠️  This will take 10-15 minutes on first run...');
    
    try {
        // Download and process ratings
        const ratingsFile = await downloadAndExtract(
            'https://datasets.imdbws.com/title.ratings.tsv.gz',
            'title.ratings.tsv'
        );
        await processRatings(ratingsFile);
        
        // Download and process episodes
        const episodesFile = await downloadAndExtract(
            'https://datasets.imdbws.com/title.episode.tsv.gz',
            'title.episode.tsv'
        );
        await processEpisodes(episodesFile);
        
        lastUpdated = new Date();
        
        console.log('🎉 All datasets processed successfully!');
        console.log(`📊 Total ratings: ${ratingsCount.toLocaleString()}`);
        console.log(`📺 Total episodes: ${episodesCount.toLocaleString()}`);
        console.log(`💾 Memory usage: ~${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
        
        return true;
        
    } catch (error) {
        console.error('💥 Error processing IMDb data:', error);
        return false;
    }
}

// API endpoint for ratings
app.get('/api/rating/:id', (req, res) => {
    const id = req.params.id;
    
    if (!id || !id.startsWith('tt')) {
        return res.status(400).json({ error: 'Invalid ID. Must start with "tt"' });
    }
    
    const ratingData = ratingsCache[id];
    
    if (ratingData) {
        return res.json({ 
            id, 
            rating: ratingData.rating,
            votes: ratingData.votes,
            type: 'direct'
        });
    } else {
        return res.status(404).json({ error: 'Rating not found for the specified ID' });
    }
});

// API endpoint for episode ratings
app.get('/api/episode/:seriesId/:season/:episode', (req, res) => {
    const { seriesId, season, episode } = req.params;
    
    if (!seriesId || !seriesId.startsWith('tt')) {
        return res.status(400).json({ error: 'Invalid series ID. Must start with "tt"' });
    }
    
    // Look up episode IMDb ID
    const episodeKey = `${seriesId}:${season}:${episode}`;
    const episodeId = episodeCache[episodeKey];
    
    if (!episodeId) {
        return res.status(404).json({ 
            error: 'Episode not found',
            seriesId,
            season,
            episode 
        });
    }
    
    // Get rating for the episode
    const ratingData = ratingsCache[episodeId];
    
    if (ratingData) {
        return res.json({
            seriesId,
            season: parseInt(season),
            episode: parseInt(episode),
            episodeId,
            rating: ratingData.rating,
            votes: ratingData.votes,
            type: 'episode'
        });
    } else {
        return res.status(404).json({ 
            error: 'Rating not found for episode',
            episodeId
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        ratingsCount: ratingsCount.toLocaleString(),
        episodesCount: episodesCount.toLocaleString(),
        memoryUsage: process.memoryUsage(),
        dataLoaded: ratingsCount > 0 && episodesCount > 0
    });
});

// Status endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Comprehensive IMDb Ratings API',
        status: 'active',
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        data: {
            ratings: ratingsCount.toLocaleString(),
            episodes: episodesCount.toLocaleString()
        },
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        endpoints: {
            movieRating: '/api/rating/:imdb_id',
            episodeRating: '/api/episode/:series_id/:season/:episode',
            health: '/health'
        },
        examples: {
            movie: '/api/rating/tt0111161',
            episode: '/api/episode/tt0903747/1/1'
        }
    });
});

// Initialize the server
app.listen(port, async () => {
    console.log(`🚀 Comprehensive IMDb Ratings API running on http://localhost:${port}`);
    console.log(`📊 Status: http://localhost:${port}/`);
    console.log(`🎬 Test movie: http://localhost:${port}/api/rating/tt0111161`);
    console.log(`📺 Test episode: http://localhost:${port}/api/episode/tt0903747/1/1`);
    console.log('');
    
    // Check if we already have data
    if (ratingsCount === 0 || episodesCount === 0) {
        console.log('⏬ No data found. Starting comprehensive download...');
        console.log('📦 This downloads ~400MB and processes millions of records...');
        console.log('⏰ Estimated time: 10-15 minutes');
        console.log('');
        await downloadAndProcessAllData();
    } else {
        console.log(`✅ Data already loaded:`);
        console.log(`   📊 ${ratingsCount.toLocaleString()} ratings`);
        console.log(`   📺 ${episodesCount.toLocaleString()} episodes`);
    }
    
    // Schedule daily updates at 2 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('🔄 Running scheduled update of IMDb datasets');
        await downloadAndProcessAllData();
    });
    
    console.log('');
    console.log('🎯 Ready to serve comprehensive ratings data!');
});