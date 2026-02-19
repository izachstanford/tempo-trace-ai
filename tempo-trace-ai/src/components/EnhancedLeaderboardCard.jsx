import React, { useState, useEffect } from 'react';

const EnhancedLeaderboardCard = ({ title, items, icon: Icon, type, year }) => {
  const [enrichedData, setEnrichedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEnrichedData = async () => {
      try {
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
            throw new Error('Failed to fetch enriched data');
          }
          data = await staticResponse.json();
        }
        
        setEnrichedData(data);
      } catch (err) {
        console.error('Error fetching enriched data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEnrichedData();
  }, []);

  const getEnrichedItem = (itemName, year = null) => {
    if (!enrichedData) return null;

    try {
      // Try to find in yearly data if year is provided
      if (year && enrichedData.yearly && enrichedData.yearly[year]) {
        const yearData = enrichedData.yearly[year];
        if (yearData[type]) {
          const found = yearData[type].find(item => 
            item.name.toLowerCase() === itemName.toLowerCase()
          );
          if (found) {
            // Extract image URL based on type
            let imageUrl = null;
            if (found.spotifyData) {
              if (type === 'artists') {
                // For artists, use spotifyData.images[0].url
                imageUrl = found.spotifyData.images?.[0]?.url;
              } else if (type === 'tracks') {
                // For tracks, use spotifyData.album.images[0].url
                imageUrl = found.spotifyData.album?.images?.[0]?.url;
              } else if (type === 'albums') {
                // For albums, use spotifyData.images[0].url
                imageUrl = found.spotifyData.images?.[0]?.url;
              }
            }
            
            // For albums, extract artist from Spotify data if not already present
            let finalArtist = found.artist;
            if (type === 'albums' && !finalArtist && found.spotifyData?.artists?.[0]?.name) {
              finalArtist = found.spotifyData.artists[0].name;
            }
            
            return {
              ...found,
              artist: finalArtist,
              image: imageUrl
            };
          }
        }
      }
    } catch (error) {
      console.error('Error finding enriched item:', error);
    }

    return null;
  };

  if (loading) {
    return (
      <div className="cyber-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Icon className="w-5 h-5 text-cyber-blue" />
          <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg animate-pulse">
              <div className="w-6 h-4 bg-gray-600 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-600 rounded mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/3"></div>
              </div>
              <div className="w-16 h-2 bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cyber-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Icon className="w-5 h-5 text-cyber-blue" />
          <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400">Error loading enriched data</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-5 h-5 text-cyber-blue" />
        <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.slice(0, 10).map((item, index) => {
          // New format: Artists [name, plays, ms], Albums [name, plays, ms], Track Artists [name, plays, artist, ms]
          let itemName, playCount, artist, msPlayed;
          if (Array.isArray(item)) {
            itemName = item[0];
            playCount = item[1];
            
            if (type === 'tracks') {
              // Track Artists format: [name, plays, artist, ms]
              artist = item[2] || null;
              msPlayed = item[3] || 0;
            } else {
              // Artists/Albums format: [name, plays, ms]
              artist = null;
              msPlayed = item[2] || 0;
            }
          } else {
            itemName = item.name;
            playCount = item.plays;
            artist = item.artist;
            msPlayed = item.ms_played || 0;
          }
          
          // Display hours for artists/albums, plays for tracks
          const displayValue = type === 'tracks' ? playCount : msPlayed / (1000 * 60 * 60);
          const displayUnit = type === 'tracks' ? 'plays' : 'hours';
          
          const enrichedItem = getEnrichedItem(itemName, year);
          const hasSpotifyData = enrichedItem && enrichedItem.spotifyUrl;
          
          const ItemComponent = hasSpotifyData ? 'a' : 'div';
          const itemProps = hasSpotifyData ? {
            href: enrichedItem.spotifyUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg hover:bg-card-bg/70 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer'
          } : {
            className: 'flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg hover:bg-card-bg/70 transition-colors'
          };

          return (
            <ItemComponent key={index} {...itemProps}>
              <span className="text-sm font-mono text-cyber-blue w-6 text-right">
                {index + 1}
              </span>
              
              {/* Image */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                {enrichedItem?.image ? (
                  <img 
                    src={enrichedItem.image} 
                    alt={itemName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full flex items-center justify-center text-gray-400 text-xs"
                  style={{ display: enrichedItem?.image ? 'none' : 'flex' }}
                >
                  {type === 'artists' ? '🎤' : type === 'tracks' ? '🎵' : '💿'}
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{itemName}</p>
                {title === 'Top Artists' ? (
                  <p className="text-xs text-gray-500 truncate">&nbsp;</p>
                ) : (
                  (artist || enrichedItem?.artist) && (
                    <p className="text-xs text-gray-500 truncate">by {artist || enrichedItem.artist}</p>
                  )
                )}
              </div>
              
              {/* Display Value */}
              <div className="text-right">
                <p className="text-cyber-blue font-bold text-sm">
                  {type === 'tracks' 
                    ? playCount.toLocaleString() 
                    : displayValue > 1 
                      ? displayValue.toFixed(1)
                      : displayValue.toFixed(2)
                  }
                </p>
                <p className="text-xs text-gray-400">{displayUnit}</p>
              </div>
            </ItemComponent>
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedLeaderboardCard;
