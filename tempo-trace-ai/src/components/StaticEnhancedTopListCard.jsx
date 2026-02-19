import React, { useState, useEffect } from 'react';
import { ExternalLink, Music, Users, Award } from 'lucide-react';

const StaticEnhancedTopListCard = ({ title, items, icon: Icon, showIndex = true }) => {
  const [enrichedData, setEnrichedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadEnrichedData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try API first, fallback to static file if not available
        const API_BASE = 'https://aiwithzach.com/api';
        let data;
        
        try {
          const apiResponse = await fetch(`${API_BASE}/tempo-api-enriched-data`);
          if (apiResponse.ok) {
            data = await apiResponse.json();
          } else {
            throw new Error('API not available');
          }
        } catch (apiError) {
          console.log('API not available, using static fallback');
          const staticResponse = await fetch('./data/spotify_enriched_data.json');
          if (!staticResponse.ok) {
            throw new Error(`Failed to load Spotify data: ${staticResponse.status}`);
          }
          data = await staticResponse.json();
        }

        setEnrichedData(data);
      } catch (err) {
        console.error('Error loading enriched data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEnrichedData();
  }, []);

  const getDefaultIcon = () => {
    if (title === 'Top Artists') return Users;
    if (title === 'Top Tracks') return Music;
    if (title === 'Top Albums') return Award;
    return Icon;
  };

  const DefaultIcon = getDefaultIcon();

  const getEnrichedItems = () => {
    if (!enrichedData) {
      // Handle both old format [name, plays] and new format [name, plays, artist]
      return items.map(item => {
        if (Array.isArray(item)) {
          return { 
            name: item[0], 
            plays: item[1], 
            artist: item[2] || null,
            image: null, 
            spotifyUrl: null 
          };
        }
        return item;
      });
    }

    let enrichedItems = [];
    if (title === 'Top Artists') {
      enrichedItems = enrichedData.lifetime?.artists || [];
    } else if (title === 'Top Tracks') {
      enrichedItems = enrichedData.lifetime?.tracks || [];
    } else if (title === 'Top Albums') {
      enrichedItems = enrichedData.lifetime?.albums || [];
    }

    // New format: Artists [name, plays, ms], Albums [name, plays, ms], Track Artists [name, plays, artist, ms]
    const mergedItems = items.map(item => {
      let name, plays, artist, msPlayed;
      if (Array.isArray(item)) {
        name = item[0];
        plays = item[1];
        
        if (title === 'Top Tracks') {
          // Track Artists format: [name, plays, artist, ms]
          artist = item[2] || null;
          msPlayed = item[3] || 0;
        } else {
          // Artists/Albums format: [name, plays, ms]
          artist = null;
          msPlayed = item[2] || 0;
        }
      } else {
        name = item.name;
        plays = item.plays;
        artist = item.artist;
        msPlayed = item.ms_played || 0;
      }
      
      const enriched = enrichedItems.find(enrichedItem => enrichedItem.name === name);
      if (enriched) {
        // Extract image URL based on type
        let imageUrl = null;
        if (enriched.spotifyData) {
          if (title === 'Top Artists') {
            // For artists, use spotifyData.images[0].url
            imageUrl = enriched.spotifyData.images?.[0]?.url;
          } else if (title === 'Top Tracks') {
            // For tracks, use spotifyData.album.images[0].url
            imageUrl = enriched.spotifyData.album?.images?.[0]?.url;
          } else if (title === 'Top Albums') {
            // For albums, use spotifyData.images[0].url
            imageUrl = enriched.spotifyData.images?.[0]?.url;
          }
        }
        
        // For albums, extract artist from Spotify data if not already present
        let finalArtist = artist;
        if (title === 'Top Albums' && !finalArtist && enriched.spotifyData?.artists?.[0]?.name) {
          finalArtist = enriched.spotifyData.artists[0].name;
        }
        
        return {
          name,
          plays,
          artist: finalArtist,
          image: imageUrl,
          spotifyUrl: enriched.spotifyUrl,
          msPlayed
        };
      }
      
      return { name, plays, artist, image: null, spotifyUrl: null, msPlayed };
    });

    return mergedItems;
  };

  if (loading) {
    return (
      <div className="cyber-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <DefaultIcon className="w-5 h-5 text-cyber-blue" />
          <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg animate-pulse">
              <div className="w-6 h-6 bg-gray-700 rounded"></div>
              <div className="w-8 h-8 bg-gray-700 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="w-12 h-2 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const enrichedItems = getEnrichedItems();

  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <DefaultIcon className="w-5 h-5 text-cyber-blue" />
        <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
        {enrichedData && (
          <span className="text-xs text-gray-500">
            Updated: {new Date(enrichedData.lastUpdated).toLocaleDateString()}
          </span>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm">
            Spotify data unavailable: {error}. Showing basic data.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {enrichedItems.slice(0, 10).map((item, index) => {
          const ItemWrapper = item.spotifyUrl ? 'a' : 'div';
          const wrapperProps = item.spotifyUrl ? {
            href: item.spotifyUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: `Open ${item.name} in Spotify`
          } : {};

          return (
            <ItemWrapper
              key={index}
              {...wrapperProps}
              className={`flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg transition-all duration-200 group relative ${
                item.spotifyUrl 
                  ? 'hover:bg-card-bg/70 hover:scale-[1.02] hover:shadow-lg cursor-pointer' 
                  : 'hover:bg-card-bg/70'
              }`}
            >
              {showIndex && (
                <span className="text-sm font-mono text-cyber-blue w-6 text-right">
                  {index + 1}
                </span>
              )}
              
              {/* Image */}
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                {item.image ? (
                  <img 
                    src={item.image} 
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full flex items-center justify-center"
                  style={{ display: item.image ? 'none' : 'flex' }}
                >
                  <DefaultIcon className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{item.name}</p>
                {title === 'Top Artists' ? (
                  <p className="text-xs text-gray-500 truncate">&nbsp;</p>
                ) : (
                  item.artist && (
                    <p className="text-xs text-gray-500 truncate">by {item.artist}</p>
                  )
                )}
              </div>

              {/* Display Value */}
              <div className="text-right">
                {title === 'Top Tracks' ? (
                  <>
                    <p className="text-cyber-blue font-bold text-sm">{item.plays.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">plays</p>
                  </>
                ) : (
                  <>
                    <p className="text-cyber-blue font-bold text-sm">
                      {item.msPlayed / (1000 * 60 * 60) > 1 
                        ? (item.msPlayed / (1000 * 60 * 60)).toFixed(1)
                        : (item.msPlayed / (1000 * 60 * 60)).toFixed(2)
                      }
                    </p>
                    <p className="text-xs text-gray-400">hours</p>
                  </>
                )}
              </div>
            </ItemWrapper>
          );
        })}
      </div>
    </div>
  );
};

export default StaticEnhancedTopListCard;
