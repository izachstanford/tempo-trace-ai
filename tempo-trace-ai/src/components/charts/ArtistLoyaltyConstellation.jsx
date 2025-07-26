import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';

const ArtistLoyaltyConstellation = ({ data, artistSummary, concertData }) => {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [hoveredStar, setHoveredStar] = useState(null);

  const processedData = useMemo(() => {
    if (!data?.top_lists?.top_artists || !artistSummary) {
      return { constellation: [], maxValues: {}, scales: null };
    }

    const topArtists = data.top_lists.top_artists.slice(0, 12); // 12 artists for constellation
    const constellation = [];

    topArtists.forEach(([artistName, plays], index) => {
      const artistData = artistSummary[artistName];
      if (!artistData) return;

      // Calculate loyalty metrics
      const consistency = (artistData.days_active / (artistData.years_active * 365)) * 100;
      const engagement = 100 - (artistData.skip_rate_percentage || 0);
      const completion = artistData.completion_rate_percentage || 0;
      const diversityScore = (artistData.unique_tracks / plays) * 100;
      const longevity = Math.min(artistData.years_active * 10, 100);
      const concertConnection = concertData ? 
        concertData.filter(c => c.artist === artistName).length * 20 : 0;

      // Position in constellation (circular arrangement)
      const angle = (index / topArtists.length) * 2 * Math.PI;
      const radius = 120 + (plays / topArtists[0][1]) * 80; // Distance from center based on popularity
      const x = 300 + Math.cos(angle) * radius;
      const y = 200 + Math.sin(angle) * radius;

      constellation.push({
        name: artistName,
        plays,
        x,
        y,
        angle,
        radius: radius - 120,
        metrics: {
          consistency: Math.min(consistency, 100),
          engagement,
          completion,
          diversity: Math.min(diversityScore, 100),
          longevity,
          concertConnection: Math.min(concertConnection, 100)
        },
        size: 8 + (plays / topArtists[0][1]) * 12, // Star size based on popularity
        color: d3.interpolateViridis(index / topArtists.length),
        brightness: 0.5 + (plays / topArtists[0][1]) * 0.5
      });
    });

    // Calculate max values for scaling
    const maxValues = {
      consistency: Math.max(...constellation.map(s => s.metrics.consistency)),
      engagement: Math.max(...constellation.map(s => s.metrics.engagement)),
      completion: Math.max(...constellation.map(s => s.metrics.completion)),
      diversity: Math.max(...constellation.map(s => s.metrics.diversity)),
      longevity: Math.max(...constellation.map(s => s.metrics.longevity)),
      concertConnection: Math.max(...constellation.map(s => s.metrics.concertConnection))
    };

    // Create scales for radar chart
    const radarScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, 80]);

    return { constellation, maxValues, scales: { radarScale } };
  }, [data, artistSummary, concertData]);

  const generateStarPath = (size, spikes = 5) => {
    const outerRadius = size;
    const innerRadius = size * 0.4;
    const angleStep = (Math.PI * 2) / (spikes * 2);
    
    let path = '';
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * angleStep - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    }
    path += ' Z';
    return path;
  };

  const generateRadarPath = (metrics, scale, centerX, centerY, radius = 60) => {
    const dimensions = ['consistency', 'engagement', 'completion', 'diversity', 'longevity', 'concertConnection'];
    const angleStep = (2 * Math.PI) / dimensions.length;
    
    let path = '';
    dimensions.forEach((dim, i) => {
      const value = metrics[dim] || 0;
      const scaledValue = scale(value);
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (scaledValue / 80) * radius;
      const y = centerY + Math.sin(angle) * (scaledValue / 80) * radius;
      
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    path += ' Z';
    return path;
  };

  const drawRadarGrid = (centerX, centerY, radius = 60, scale) => {
    const dimensions = ['Consistency', 'Engagement', 'Completion', 'Diversity', 'Longevity', 'Concert Connection'];
    const angleStep = (2 * Math.PI) / dimensions.length;
    
    return (
      <g>
        {/* Concentric circles */}
        {[20, 40, 60, 80, 100].map((value, i) => (
          <circle
            key={i}
            cx={centerX}
            cy={centerY}
            r={(scale(value) / 80) * radius}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.5"
            opacity="0.2"
          />
        ))}
        
        {/* Radial lines and labels */}
        {dimensions.map((dim, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x1 = centerX;
          const y1 = centerY;
          const x2 = centerX + Math.cos(angle) * radius;
          const y2 = centerY + Math.sin(angle) * radius;
          const labelX = centerX + Math.cos(angle) * (radius + 15);
          const labelY = centerY + Math.sin(angle) * (radius + 15);
          
          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#ffffff"
                strokeWidth="0.5"
                opacity="0.2"
              />
              <text
                x={labelX}
                y={labelY}
                fill="#ffffff"
                fontSize="8"
                textAnchor="middle"
                dominantBaseline="central"
                className="font-semibold"
              >
                {dim}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  if (!processedData.constellation.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Loading artist constellation...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      <svg width="100%" height="100%" viewBox="0 0 600 400">
        <defs>
          <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
            <stop offset="50%" stopColor="#00f5ff" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
          </radialGradient>
          <filter id="starBloom">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="radarGlow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Individual star gradients */}
          {processedData.constellation.map((star, i) => (
            <radialGradient key={i} id={`starGradient${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
              <stop offset="30%" stopColor={star.color} stopOpacity="0.8"/>
              <stop offset="100%" stopColor={star.color} stopOpacity="0.2"/>
            </radialGradient>
          ))}
        </defs>

        {/* Background constellation lines */}
        {processedData.constellation.map((star, i) => 
          processedData.constellation.slice(i + 1).map((otherStar, j) => {
            const distance = Math.sqrt(
              Math.pow(star.x - otherStar.x, 2) + Math.pow(star.y - otherStar.y, 2)
            );
            
            if (distance < 150) { // Only connect nearby stars
              return (
                <line
                  key={`${i}-${j}`}
                  x1={star.x} y1={star.y}
                  x2={otherStar.x} y2={otherStar.y}
                  stroke="#ffffff"
                  strokeWidth="0.5"
                  opacity="0.1"
                  className="transition-opacity duration-300"
                />
              );
            }
            return null;
          })
        )}

        {/* Artist stars */}
        {processedData.constellation.map((star, index) => {
          const isSelected = selectedArtist === star.name;
          const isHovered = hoveredStar === star.name;
          const opacity = selectedArtist ? (isSelected ? 1 : 0.3) : (isHovered ? 1 : 0.8);
          
          return (
            <g key={star.name}>
              {/* Star glow */}
              <circle
                cx={star.x}
                cy={star.y}
                r={star.size * 2}
                fill="url(#starGlow)"
                opacity={opacity * star.brightness}
                className={isHovered ? 'animate-pulse' : ''}
              />
              
              {/* Main star */}
              <path
                d={generateStarPath(star.size)}
                transform={`translate(${star.x}, ${star.y})`}
                fill={`url(#starGradient${index})`}
                stroke="#ffffff"
                strokeWidth="0.5"
                opacity={opacity}
                filter="url(#starBloom)"
                className="cursor-pointer transition-all duration-300"
                onMouseEnter={() => setHoveredStar(star.name)}
                onMouseLeave={() => setHoveredStar(null)}
                onClick={() => setSelectedArtist(selectedArtist === star.name ? null : star.name)}
              />

              {/* Artist label */}
              <text
                x={star.x}
                y={star.y + star.size + 15}
                fill="#ffffff"
                fontSize="8"
                textAnchor="middle"
                className="pointer-events-none font-semibold"
                opacity={isSelected || isHovered ? 1 : 0.7}
              >
                {star.name}
              </text>

              {/* Play count */}
              <text
                x={star.x}
                y={star.y + star.size + 25}
                fill={star.color}
                fontSize="7"
                textAnchor="middle"
                className="pointer-events-none"
                opacity={isSelected || isHovered ? 1 : 0.5}
              >
                {star.plays.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Selected artist radar chart */}
        {selectedArtist && (() => {
          const star = processedData.constellation.find(s => s.name === selectedArtist);
          if (!star) return null;

          const radarCenterX = 450;
          const radarCenterY = 120;
          const radarRadius = 60;

          return (
            <g>
              {/* Radar background */}
              <circle
                cx={radarCenterX}
                cy={radarCenterY}
                r={radarRadius + 20}
                fill="rgba(0, 0, 0, 0.7)"
                stroke="#00f5ff"
                strokeWidth="1"
                rx="10"
              />

              {/* Radar grid */}
              {drawRadarGrid(radarCenterX, radarCenterY, radarRadius, processedData.scales.radarScale)}

              {/* Radar path */}
              <path
                d={generateRadarPath(star.metrics, processedData.scales.radarScale, radarCenterX, radarCenterY, radarRadius)}
                fill={star.color}
                fillOpacity="0.3"
                stroke={star.color}
                strokeWidth="2"
                filter="url(#radarGlow)"
              />

              {/* Radar points */}
              {Object.entries(star.metrics).map(([metric, value], i) => {
                const dimensions = ['consistency', 'engagement', 'completion', 'diversity', 'longevity', 'concertConnection'];
                const angle = (i / dimensions.length) * 2 * Math.PI - Math.PI / 2;
                const scaledValue = processedData.scales.radarScale(value);
                const x = radarCenterX + Math.cos(angle) * (scaledValue / 80) * radarRadius;
                const y = radarCenterY + Math.sin(angle) * (scaledValue / 80) * radarRadius;

                return (
                  <circle
                    key={metric}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#ffffff"
                    stroke={star.color}
                    strokeWidth="2"
                  />
                );
              })}

              {/* Radar title */}
              <text
                x={radarCenterX}
                y={radarCenterY - radarRadius - 30}
                fill="#ffffff"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
              >
                {star.name} - Loyalty Profile
              </text>
            </g>
          );
        })()}

        {/* Legend */}
        <g transform="translate(20, 20)">
          <rect width="180" height="120" fill="rgba(0, 0, 0, 0.8)" rx="8" />
          <text x="10" y="20" fill="#ffffff" fontSize="12" fontWeight="bold">
            Artist Constellation
          </text>
          
          <g transform="translate(10, 35)">
            <path
              d={generateStarPath(6)}
              transform="translate(8, 8)"
              fill="#00f5ff"
              opacity="0.8"
            />
            <text x="25" y="12" fill="#ffffff" fontSize="9">Size = Popularity</text>
            
            <circle cx="8" cy="25" r="4" fill="url(#starGlow)" />
            <text x="20" y="29" fill="#ffffff" fontSize="9">Brightness = Plays</text>
            
            <line x1="5" y1="40" x2="15" y2="40" stroke="#ffffff" strokeWidth="0.5" />
            <text x="20" y="44" fill="#ffffff" fontSize="9">Connections = Similarity</text>
          </g>

          <text x="10" y="75" fill="#00f5ff" fontSize="10" fontWeight="semibold">
            Click star for loyalty radar
          </text>
          
          <text x="10" y="90" fill="#8b5cf6" fontSize="9">
            {processedData.constellation.length} artists mapped
          </text>
        </g>

        {/* Hover info */}
        {hoveredStar && !selectedArtist && (() => {
          const star = processedData.constellation.find(s => s.name === hoveredStar);
          if (!star) return null;

          return (
            <g transform="translate(400, 300)">
              <rect width="180" height="80" fill="rgba(0, 0, 0, 0.9)" rx="8" />
              <text x="10" y="20" fill={star.color} fontSize="14" fontWeight="bold">
                {star.name}
              </text>
              <text x="10" y="35" fill="#ffffff" fontSize="10">
                {star.plays.toLocaleString()} plays
              </text>
              <text x="10" y="50" fill="#ffffff" fontSize="9">
                Engagement: {Math.round(star.metrics.engagement)}%
              </text>
              <text x="10" y="65" fill="#ffffff" fontSize="9">
                Loyalty Score: {Math.round((star.metrics.consistency + star.metrics.engagement) / 2)}%
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-3 hidden md:block">
        <div className="text-cyber-blue text-xs font-semibold mb-2">Navigation</div>
        <button
          onClick={() => setSelectedArtist(null)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            selectedArtist === null 
              ? 'bg-cyber-blue text-white' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          Clear Selection
        </button>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 max-w-sm hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Artist Loyalty Constellation</h4>
        <p className="text-gray-400 text-xs">
          Each star represents an artist. Size shows popularity, brightness shows play count. 
          Click any star to see detailed loyalty metrics in radar form.
        </p>
      </div>
    </div>
  );
};

export default ArtistLoyaltyConstellation;
