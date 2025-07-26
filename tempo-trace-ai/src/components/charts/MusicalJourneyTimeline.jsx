import React, { useState, useMemo } from 'react';
import * as d3 from 'd3';

const MusicalJourneyTimeline = ({ data }) => {
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [selectedArtists, setSelectedArtists] = useState(new Set());

  const processedData = useMemo(() => {
    if (!data?.temporal_patterns?.monthly_breakdown || !data?.top_lists?.top_artists) {
      return { layers: [], timeScale: null, artistScale: null, months: [] };
    }

    const monthlyData = data.temporal_patterns.monthly_breakdown;
    // Use all top artists, sorted in reverse order by total plays
    const topArtists = [...data.top_lists.top_artists]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    // Get all months
    const months = Object.keys(monthlyData).sort();
    const layers = [];

    topArtists.forEach((artist, artistIndex) => {
      const artistData = months.map(month => {
        // If you have per-artist, per-month data, use it here. Otherwise, fallback to 0.
        // This assumes monthlyData[month].artist_plays[artist] exists, otherwise fallback to 0.
        const monthData = monthlyData[month];
        let plays = 0;
        if (monthData.artist_plays && monthData.artist_plays[artist] !== undefined) {
          plays = monthData.artist_plays[artist];
        }
        // If no per-artist data, fallback to 0
        return {
          month,
          artist,
          plays,
          intensity: plays, // Use plays directly for now
          color: d3.interpolateViridis(artistIndex / topArtists.length)
        };
      });
      layers.push(artistData);
    });

    const width = 800;
    const height = 400;
    
    const timeScale = d3.scaleTime()
      .domain(d3.extent(months.map(m => new Date(m))))
      .range([50, width - 50]);

    const artistScale = d3.scaleBand()
      .domain(topArtists)
      .range([height - 50, 50])
      .padding(0.1);

    return { layers, timeScale, artistScale, months, topArtists, width, height };
  }, [data]);

  const generateStreamPath = (artistData, index) => {
    if (!processedData.timeScale || !processedData.artistScale) return '';
    
    const { timeScale, artistScale } = processedData;
    const bandwidth = artistScale.bandwidth();
    
    const points = artistData.map((d, i) => {
      const x = timeScale(new Date(d.month));
      const y = artistScale(d.artist) + bandwidth / 2;
      const intensity = d.intensity;
      const thickness = intensity * bandwidth * 0.8;
      
      return { x, y: y - thickness/2, y2: y + thickness/2, intensity };
    });

    // Create flowing stream path
    const line = d3.line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveBasis);

    const line2 = d3.line()
      .x(d => d.x)
      .y(d => d.y2)
      .curve(d3.curveBasis);

    const topPath = line(points);
    const bottomPath = line2(points.slice().reverse());
    
    return `${topPath}L${bottomPath.substring(1)}Z`;
  };

  if (!processedData.layers.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Loading musical journey...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg width="100%" height="100%" viewBox={`0 0 ${processedData.width} ${processedData.height}`}>
        <defs>
          <linearGradient id="streamGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 245, 255, 0.1)" />
            <stop offset="50%" stopColor="rgba(139, 92, 246, 0.3)" />
            <stop offset="100%" stopColor="rgba(244, 114, 182, 0.1)" />
          </linearGradient>
          {processedData.layers.map((artistData, index) => (
            <linearGradient key={index} id={`artistGradient${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={artistData[0].color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={artistData[0].color} stopOpacity="0.2" />
            </linearGradient>
          ))}
        </defs>

        {/* Background grid */}
        <g className="opacity-20">
          {processedData.months.filter((_, i) => i % 6 === 0).map(month => {
            const x = processedData.timeScale(new Date(month));
            return (
              <line key={month} x1={x} y1="50" x2={x} y2={processedData.height - 50} 
                    stroke="#ffffff" strokeWidth="0.5" strokeDasharray="2,2" />
            );
          })}
        </g>

        {/* Artist streams */}
        {processedData.layers.map((artistData, index) => {
          const isSelected = selectedArtists.size === 0 || selectedArtists.has(artistData[0].artist);
          const opacity = isSelected ? 0.8 : 0.3;
          
          return (
            <g key={index}>
              <path
                d={generateStreamPath(artistData, index)}
                fill={`url(#artistGradient${index})`}
                stroke={artistData[0].color}
                strokeWidth="1"
                opacity={opacity}
                className="transition-all duration-300 cursor-pointer hover:opacity-100"
                onMouseEnter={() => setSelectedArtists(new Set([artistData[0].artist]))}
                onMouseLeave={() => setSelectedArtists(new Set())}
              />
              
              {/* Artist label */}
              <text
                x={processedData.width - 45}
                y={processedData.artistScale(artistData[0].artist) + processedData.artistScale.bandwidth()/2}
                fill={artistData[0].color}
                fontSize="16"
                textAnchor="start"
                className="font-bold"
                opacity={isSelected ? 1 : 0.5}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {artistData[0].artist}
              </text>
            </g>
          );
        })}

        {/* Time axis labels */}
        {processedData.months.filter((_, i) => i % 12 === 0).map(month => {
          const x = processedData.timeScale(new Date(month));
          return (
            <text key={month} x={x} y={processedData.height - 30} 
                  fill="#ffffff" fontSize="10" textAnchor="middle">
              {new Date(month).getFullYear()}
            </text>
          );
        })}

        {/* Interactive overlay for monthly details */}
        {hoveredMonth && (
          <g>
            <rect
              x={processedData.timeScale(new Date(hoveredMonth)) - 30}
              y="10"
              width="60"
              height="30"
              fill="rgba(26, 26, 26, 0.9)"
              stroke="#00f5ff"
              strokeWidth="1"
              rx="4"
            />
            <text
              x={processedData.timeScale(new Date(hoveredMonth))}
              y="25"
              fill="#00f5ff"
              fontSize="10"
              textAnchor="middle"
            >
              {new Date(hoveredMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-black/70 rounded-lg p-3 max-w-xs hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Musical Evolution</h4>
        <p className="text-gray-400 text-xs">
          Stream thickness shows listening intensity. Hover over streams to highlight individual artists.
        </p>
      </div>

      {/* Controls */}
      <div className="absolute top-2 right-2 space-x-2">
        <button
          onClick={() => setSelectedArtists(new Set())}
          className="px-2 py-1 bg-cyber-blue/20 hover:bg-cyber-blue/40 rounded text-xs text-white transition-colors"
        >
          Show All
        </button>
      </div>
    </div>
  );
};

export default MusicalJourneyTimeline;
