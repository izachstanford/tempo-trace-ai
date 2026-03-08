import React from 'react';
import { Music, Users, Award } from 'lucide-react';

const StaticEnhancedTopListCard = ({ title, items, icon: Icon, showIndex = true }) => {
  const getDefaultIcon = () => {
    if (title === 'Top Artists') return Users;
    if (title === 'Top Tracks') return Music;
    if (title === 'Top Albums') return Award;
    return Icon;
  };

  const DefaultIcon = getDefaultIcon();

  const getEnrichedItems = () => {
    // Parse array items. Supported formats (all include optional spotify_url + image_url at the end):
    //   Artists: [name, plays, ms, spotify_url?, image_url?]
    //   Tracks:  [name, plays, artist, ms, spotify_url?, image_url?]
    //   Albums:  [name, plays, ms, artist, spotify_url?, image_url?]
    const mergedItems = items.map(item => {
      if (!Array.isArray(item)) return item;

      let name, plays, artist, msPlayed, spotifyUrl, imageUrl;
      name   = item[0];
      plays  = item[1];

      if (title === 'Top Tracks') {
        artist     = item[2] || null;
        msPlayed   = item[3] || 0;
        spotifyUrl = item[4] || null;
        imageUrl   = item[5] || null;
      } else if (title === 'Top Albums') {
        msPlayed   = item[2] || 0;
        artist     = item[3] || null;
        spotifyUrl = item[4] || null;
        imageUrl   = item[5] || null;
      } else {
        // Artists: [name, plays, ms, spotify_url?, image_url?]
        msPlayed   = item[2] || 0;
        spotifyUrl = item[3] || null;
        imageUrl   = item[4] || null;
      }

      return { name, plays, artist, msPlayed, image: imageUrl, spotifyUrl };
    });

    return mergedItems;
  };

  // No loading state needed — all data is embedded in the items array
  const enrichedItems = getEnrichedItems();

  // Kept for compatibility in case a parent still passes a dummy enriched block
  const error = null;
      if (enriched) {
  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <DefaultIcon className="w-5 h-5 text-cyber-blue" />
        <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm">
            Data unavailable: {error}
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
                ) : item.artist ? (
                  <p className="text-xs text-gray-500 truncate">by {item.artist}</p>
                ) : (
                  <p className="text-xs text-gray-500 truncate">&nbsp;</p>
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
