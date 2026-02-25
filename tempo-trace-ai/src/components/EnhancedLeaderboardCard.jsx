import React, { useState, useEffect } from 'react';

const EnhancedLeaderboardCard = ({ title, items, icon: Icon, type, year }) => {
  const [enrichedData, setEnrichedData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrichedData = async () => {
      try {
        const API_BASE = 'https://aiwithzach.com/api';
        let data;
        try {
          const res = await fetch(`${API_BASE}/tempo-api-enriched-data`);
          if (res.ok) data = await res.json();
          else throw new Error('API not available');
        } catch {
          const res = await fetch('./data/spotify_enriched_data.json');
          if (res.ok) data = await res.json();
        }
        setEnrichedData(data);
      } catch (err) {
        console.warn('Could not load enriched data:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEnrichedData();
  }, []);

  // Pull artwork + Spotify URL from lifetime enriched data by name
  const getEnrichedItem = (itemName) => {
    if (!enrichedData?.lifetime) return null;
    const key = type === 'artists' ? 'artists' : type === 'tracks' ? 'tracks' : 'albums';
    const found = (enrichedData.lifetime[key] || []).find(
      i => i.name?.toLowerCase() === itemName?.toLowerCase()
    );
    if (!found) return null;

    let image = found.image || null;
    if (found.spotifyData) {
      if (type === 'artists') image = found.spotifyData.images?.[0]?.url || image;
      else if (type === 'tracks') image = found.spotifyData.album?.images?.[0]?.url || image;
      else if (type === 'albums') image = found.spotifyData.images?.[0]?.url || image;
    }
    const artist = found.artist || (type === 'albums' ? found.spotifyData?.artists?.[0]?.name : null);
    return { ...found, image, artist };
  };

  // Parse item array into named fields (API may include embedded image/url)
  // Artists:  [name, plays, ms_played, artist_url?, artist_image_url?]
  // Tracks:   [name, plays, artist, ms_played, track_url?, album_image_url?]
  // Albums:   [name, plays, ms_played, artist, album_url?, album_image_url?]
  const parseItem = (item) => {
    if (!Array.isArray(item)) {
      return { name: item.name, plays: item.plays, artist: item.artist, msPlayed: item.ms_played || 0, url: null, image: null };
    }
    if (type === 'tracks') {
      return {
        name: item[0], plays: item[1], artist: item[2] || null, msPlayed: item[3] || 0,
        url: item[4] || null, image: item[5] || null
      };
    }
    if (type === 'albums') {
      return {
        name: item[0], plays: item[1], msPlayed: item[2] || 0, artist: item[3] || null,
        url: item[4] || null, image: item[5] || null
      };
    }
    // artists: [name, plays, ms_played, artist_url?, artist_image_url?]
    return {
      name: item[0], plays: item[1], msPlayed: item[2] || 0, artist: null,
      url: item[3] || null, image: item[4] || null
    };
  };

  if (loading) {
    return (
      <div className="cyber-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Icon className="w-5 h-5 text-cyber-blue" />
          <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg animate-pulse">
              <div className="w-6 h-4 bg-gray-600 rounded"></div>
              <div className="w-12 h-12 bg-gray-700 rounded-lg flex-shrink-0"></div>
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

  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-5 h-5 text-cyber-blue" />
        <h3 className="text-lg font-bold text-cyber-blue">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.slice(0, 10).map((item, index) => {
          const parsed = parseItem(item);
          const { name, plays, artist, msPlayed, url: embeddedUrl, image: embeddedImage } = parsed;
          const enriched = getEnrichedItem(name);

          // Use embedded image/url from API when present (e.g. annual recaps); fall back to enriched lookup
          const image = embeddedImage || enriched?.image || null;
          const spotifyUrl = embeddedUrl || enriched?.spotifyUrl || null;
          const displayArtist = artist || enriched?.artist || null;

          const displayValue = type === 'tracks' ? plays : msPlayed / (1000 * 60 * 60);
          const displayUnit  = type === 'tracks' ? 'plays' : 'hours';

          const ItemComponent = spotifyUrl ? 'a' : 'div';
          const itemProps = spotifyUrl
            ? { href: spotifyUrl, target: '_blank', rel: 'noopener noreferrer',
                className: 'flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg hover:bg-card-bg/70 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer' }
            : { className: 'flex items-center gap-3 p-3 bg-card-bg/50 rounded-lg hover:bg-card-bg/70 transition-colors' };

          return (
            <ItemComponent key={index} {...itemProps}>
              <span className="text-sm font-mono text-cyber-blue w-6 text-right">{index + 1}</span>

              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                {image ? (
                  <img
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div
                  className="w-full h-full flex items-center justify-center text-gray-400 text-xs"
                  style={{ display: image ? 'none' : 'flex' }}
                >
                  {type === 'artists' ? '🎤' : type === 'tracks' ? '🎵' : '💿'}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{name}</p>
                {type !== 'artists' && displayArtist && (
                  <p className="text-xs text-gray-500 truncate">by {displayArtist}</p>
                )}
              </div>

              <div className="text-right">
                <p className="text-cyber-blue font-bold text-sm">
                  {type === 'tracks'
                    ? plays.toLocaleString()
                    : displayValue > 1 ? displayValue.toFixed(1) : displayValue.toFixed(2)
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
