const { addonBuilder } = require('stremio-addon-sdk');
const https = require('https');

// Add-on manifest
const manifest = {
    id: 'imdb.ratings.local',
    version: '2.0.0',
    name: 'IMDb Ratings (Local Dataset)',
    description: 'Shows IMDb ratings for movies and TV episodes using local IMDb dataset',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: [],
    idPrefixes: ['tt'] // IMDb ID prefix
};

const builder = new addonBuilder(manifest);

// Configuration for local ratings API
const RATINGS_API_URL = process.env.RATINGS_API_URL || 'http://localhost:3001';

// Helper function to make HTTP requests
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : require('http');
        protocol.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

// Get IMDb rating from local comprehensive dataset API
async function getRatingFromDataset(imdbId) {
    try {
        const url = `${RATINGS_API_URL}/api/rating/${imdbId}`;
        console.log(`🔗 Fetching rating from local dataset:`, url);
        
        const data = await makeRequest(url);
        console.log('📊 Local API response:', data);
        
        if (data && data.rating && !data.error) {
            return {
                rating: data.rating,
                votes: data.votes || '0',
                id: data.id,
                type: data.type || 'direct'
            };
        }
        
        console.log('⚠️ No rating found in local dataset');
        return null;
    } catch (error) {
        console.error('💥 Error fetching from local dataset:', error);
        return null;
    }
}

// Get episode-specific rating from local dataset API
async function getEpisodeRatingFromDataset(seriesId, season, episode) {
    try {
        const url = `${RATINGS_API_URL}/api/episode/${seriesId}/${season}/${episode}`;
        console.log(`🔗 Fetching episode rating from local dataset:`, url);
        
        const data = await makeRequest(url);
        console.log('📺 Episode API response:', data);
        
        if (data && data.rating && !data.error) {
            return {
                rating: data.rating,
                votes: data.votes || '0',
                episodeId: data.episodeId,
                type: 'episode'
            };
        }
        
        console.log('⚠️ No episode rating found in local dataset');
        return null;
    } catch (error) {
        console.error('💥 Error fetching episode from local dataset:', error);
        return null;
    }
}

// Stream handler
builder.defineStreamHandler(async (args) => {
    try {
        console.log('🎬 Stream request received:', args);
        const { type, id } = args;
        
        if (type !== 'series' && type !== 'movie') {
            return { streams: [] };
        }
        
        const streams = [];
        let targetImdbId = id;
        
        if (type === 'series') {
            // For series, extract the base IMDb ID and get episode-specific rating
            const [imdbId, season, episode] = id.split(':');
            
            if (!imdbId || !season || !episode) {
                console.log('❌ Invalid series ID format:', id);
                return { streams: [] };
            }
            
            console.log(`📺 Processing episode ${season}x${episode} for series ${imdbId}`);
            
            // Try to get episode-specific rating first
            let ratingData = await getEpisodeRatingFromDataset(imdbId, season, episode);
            
            if (!ratingData) {
                console.log('🔄 No episode rating found, trying series rating as fallback...');
                ratingData = await getRatingFromDataset(imdbId);
                if (ratingData) {
                    ratingData.type = 'series_fallback';
                }
            }
            
            if (ratingData) {
                const votesText = ratingData.votes ? ` (${ratingData.votes} votes)` : '';
                
                const formattedLines = [
                    "───────────────",
                    `⭐ IMDb        : ${ratingData.rating}/10${votesText}`,
                    "───────────────"
                ];
                
                // Add note about rating type
                if (ratingData.type === 'episode') {
                    formattedLines.splice(2, 0, "(Episode Rating)");
                } else if (ratingData.type === 'series_fallback') {
                    formattedLines.splice(2, 0, "(Series Rating)");
                }
                
                const stream = {
                    name: "📊 IMDb Rating",
                    description: formattedLines.join('\n'),
                    externalUrl: `https://www.imdb.com/title/${ratingData.episodeId || imdbId}/`,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: `ratings-${id}`
                    },
                    type: "other"
                };
                
                streams.push(stream);
                console.log(`✅ Added ${ratingData.type} rating stream: ${ratingData.rating}/10`);
            } else {
                // No rating available
                streams.push({
                    name: "📊 IMDb Rating",
                    description: "───────────────\n⭐ IMDb Rating: Not Available\n───────────────",
                    externalUrl: `https://www.imdb.com/title/${imdbId}/`,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: `ratings-${id}`
                    },
                    type: "other"
                });
                console.log('❌ Added "no rating" stream');
            }
        } else {
            console.log(`🎥 Processing movie: ${id}`);
            
            // Get movie rating from local dataset
            const ratingData = await getRatingFromDataset(id);
            
            if (ratingData) {
                const votesText = ratingData.votes ? ` (${ratingData.votes} votes)` : '';
                
                const formattedLines = [
                    "───────────────",
                    `⭐ IMDb        : ${ratingData.rating}/10${votesText}`,
                    "───────────────"
                ];
                
                const stream = {
                    name: "📊 IMDb Rating",
                    description: formattedLines.join('\n'),
                    externalUrl: `https://www.imdb.com/title/${id}/`,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: `ratings-${id}`
                    },
                    type: "other"
                };
                
                streams.push(stream);
                console.log(`✅ Added movie rating stream: ${ratingData.rating}/10`);
            } else {
                // No rating available for movie
                streams.push({
                    name: "📊 IMDb Rating",
                    description: "───────────────\n⭐ IMDb Rating: Not Available\n───────────────",
                    externalUrl: `https://www.imdb.com/title/${id}/`,
                    behaviorHints: {
                        notWebReady: true,
                        bingeGroup: `ratings-${id}`
                    },
                    type: "other"
                });
                console.log('❌ Added "no rating" stream for movie');
            }
        }
        
        console.log(`📤 Returning ${streams.length} streams`);
        return { streams };
        
    } catch (error) {
        console.error('💥 Stream handler error:', error);
        return { streams: [] };
    }
});

// Export the add-on
module.exports = builder.getInterface();

// If running directly (for testing)
if (require.main === module) {
    const { serveHTTP } = require('stremio-addon-sdk');
    const port = process.env.PORT || 3000;
    
    console.log(`Starting IMDb Ratings add-on on port ${port}`);
    console.log(`Will connect to ratings API at: ${RATINGS_API_URL}`);
    console.log(`Make sure your local ratings API is running!`);
    
    serveHTTP(builder.getInterface(), { port });
}