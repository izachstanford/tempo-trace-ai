import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';

const ArtistRankingSankey = ({ data, recapData, artistSummary }) => {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const processedData = useMemo(() => {
    if (!recapData || !artistSummary) {
      return { nodes: [], links: [], years: [] };
    }

    // Get years from recap data
    const years = Object.keys(recapData).filter(year => 
      recapData[year] && recapData[year].top_artists
    ).sort();

    if (years.length < 2) {
      return { nodes: [], links: [], years: [] };
    }

    // Get last 7 years of data
    const recentYears = years.slice(-7);

    // Helper function to get artist's actual rank in a specific year
    const getArtistRankInYear = (artistName, year) => {
      const artistData = artistSummary[artistName];
      if (!artistData || !artistData.yearly_breakdown || !artistData.yearly_breakdown[year]) {
        return null; // Artist not active this year
      }
      
      // Get all artists active in this year and their streams
      const yearArtists = Object.entries(artistSummary)
        .filter(([artist, data]) => data.yearly_breakdown && data.yearly_breakdown[year])
        .map(([artist, data]) => ({
          artist,
          streams: data.yearly_breakdown[year].streams || 0
        }))
        .filter(item => item.streams > 0)
        .sort((a, b) => b.streams - a.streams);
      
      // Find the rank of our target artist
      const rankIndex = yearArtists.findIndex(item => item.artist === artistName);
      return rankIndex !== -1 ? rankIndex + 1 : null;
    };

    // Calculate top 5 artists for each year from real data
    const yearlyRankings = {};
    const allArtists = new Set();

    recentYears.forEach(year => {
      const yearData = recapData[year];
      if (!yearData || !yearData.top_artists) return;

      // Get top 5 artists for this year
      const top5Artists = yearData.top_artists.slice(0, 5).map(([artist, plays], index) => ({
        artist,
        plays,
        rank: index + 1
      }));

      yearlyRankings[year] = top5Artists;
      top5Artists.forEach(a => allArtists.add(a.artist));
    });

    // Create nodes for the Sankey diagram
    const nodes = [];
    const nodePositions = new Map();

    // Calculate positions
    const width = 600;
    const height = 350;
    const xStep = width / (recentYears.length + 1);
    const yStep = height / 6; // 5 ranks + some padding

    recentYears.forEach((year, yearIndex) => {
      const x = xStep * (yearIndex + 1);
      
      yearlyRankings[year].forEach((artistData, rank) => {
        const y = yStep * (rank + 1);
        const nodeId = `${artistData.artist}-${year}`;
        
        // Find actual previous year rank for this artist using artistSummary data
        let previousRank = null;
        if (yearIndex > 0) {
          const previousYear = recentYears[yearIndex - 1];
          previousRank = getArtistRankInYear(artistData.artist, previousYear);
        } else {
          // For the first year in our chart, check the year before our range
          const yearsBeforeChart = years.filter(y => parseInt(y) < parseInt(year)).sort();
          if (yearsBeforeChart.length > 0) {
            const previousYear = yearsBeforeChart[yearsBeforeChart.length - 1]; // Get the most recent year before our chart
            previousRank = getArtistRankInYear(artistData.artist, previousYear);
          }
        }
        
        const node = {
          id: nodeId,
          artist: artistData.artist,
          year,
          rank: artistData.rank,
          plays: artistData.plays,
          previousRank,
          x,
          y,
          yearIndex,
          color: d3.schemeCategory10[Array.from(allArtists).indexOf(artistData.artist) % 10]
        };
        
        nodes.push(node);
        nodePositions.set(nodeId, node);
      });
    });

    // Create links between consecutive years
    const links = [];
    
    for (let i = 0; i < recentYears.length - 1; i++) {
      const currentYear = recentYears[i];
      const nextYear = recentYears[i + 1];
      
      const currentRanking = yearlyRankings[currentYear];
      const nextRanking = yearlyRankings[nextYear];
      
      currentRanking.forEach((currentArtist, currentRank) => {
        const nextRank = nextRanking.findIndex(a => a.artist === currentArtist.artist);
        
        if (nextRank !== -1) {
          // Artist appears in both years
          const sourceId = `${currentArtist.artist}-${currentYear}`;
          const targetId = `${currentArtist.artist}-${nextYear}`;
          
          const source = nodePositions.get(sourceId);
          const target = nodePositions.get(targetId);
          
          if (source && target) {
            const rankChange = (currentRank + 1) - (nextRank + 1); // Positive = rank dropped, negative = rank improved
            
            links.push({
              source: sourceId,
              target: targetId,
              artist: currentArtist.artist,
              value: Math.max(currentArtist.plays, nextRanking[nextRank].plays),
              rankChange,
              sourceRank: currentRank + 1,
              targetRank: nextRank + 1,
              sourceNode: source,
              targetNode: target,
              color: source.color
            });
          }
        } else {
          // Artist dropped out of top 5
          const sourceId = `${currentArtist.artist}-${currentYear}`;
          const source = nodePositions.get(sourceId);
          
          if (source) {
            links.push({
              source: sourceId,
              target: 'exit-' + nextYear,
              artist: currentArtist.artist,
              value: currentArtist.plays,
              rankChange: 10, // Represents falling out of top 5
              sourceRank: currentRank + 1,
              targetRank: null,
              sourceNode: source,
              targetNode: { x: source.x + xStep, y: height - 30, artist: 'Exit' },
              color: source.color,
              isExit: true
            });
          }
        }
      });
      
      // Handle new entries
      nextRanking.forEach((nextArtist, nextRank) => {
        const currentRank = currentRanking.findIndex(a => a.artist === nextArtist.artist);
        
        if (currentRank === -1) {
          // New artist in top 5
          const targetId = `${nextArtist.artist}-${nextYear}`;
          const target = nodePositions.get(targetId);
          
          if (target) {
            links.push({
              source: 'entry-' + currentYear,
              target: targetId,
              artist: nextArtist.artist,
              value: nextArtist.plays,
              rankChange: -10, // Represents new entry
              sourceRank: null,
              targetRank: nextRank + 1,
              sourceNode: { x: target.x - xStep, y: height - 30, artist: 'Entry' },
              targetNode: target,
              color: target.color,
              isEntry: true
            });
          }
        }
      });
    }

    return { nodes, links, years: recentYears, yearlyRankings };
  }, [recapData, artistSummary]);

  const generatePath = (link) => {
    if (!link.sourceNode || !link.targetNode) return '';
    
    const x1 = link.sourceNode.x;
    const y1 = link.sourceNode.y;
    const x2 = link.targetNode.x;
    const y2 = link.targetNode.y;
    
    // Create curved path
    const midX = (x1 + x2) / 2;
    
    return `M ${x1} ${y1} Q ${midX} ${y1} ${midX} ${(y1 + y2) / 2} Q ${midX} ${y2} ${x2} ${y2}`;
  };

  const getLinkOpacity = (link) => {
    if (!selectedArtist && !hoveredNode) return 0.6;
    if (selectedArtist && link.artist === selectedArtist) return 1;
    if (hoveredNode && (link.source === hoveredNode.id || link.target === hoveredNode.id)) return 1;
    return 0.2;
  };

  const getNodeOpacity = (node) => {
    if (!selectedArtist && !hoveredNode) return 1;
    if (selectedArtist && node.artist === selectedArtist) return 1;
    if (hoveredNode && node.id === hoveredNode.id) return 1;
    return 0.3;
  };

  const getRankChangeColor = (rankChange) => {
    if (rankChange < -1) return '#10b981'; // Significant improvement (green)
    if (rankChange === -1) return '#34d399'; // Small improvement (light green)
    if (rankChange === 0) return '#fbbf24'; // No change (yellow)
    if (rankChange === 1) return '#f87171'; // Small drop (light red)
    if (rankChange > 1) return '#dc2626'; // Significant drop (red)
    return '#8b5cf6'; // Special cases (purple)
  };

  if (!processedData.nodes.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p>No ranking data available</p>
          <p className="text-sm mt-1">Need at least 2 years of data for rankings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <svg width="100%" height="100%" viewBox="0 0 700 400">
        <defs>
          <filter id="linkGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background grid */}
        <g opacity="0.1">
          {processedData.years.map((year, i) => {
            const x = (600 / (processedData.years.length + 1)) * (i + 1);
            return (
              <line
                key={year}
                x1={x}
                y1="50"
                x2={x}
                y2="320"
                stroke="#ffffff"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            );
          })}
        </g>

        {/* Year labels */}
        {processedData.years.map((year, i) => {
            const x = (600 / (processedData.years.length + 1)) * (i + 1);
          return (
            <text
              key={year}
              x={x}
              y="35"
              fill="#ffffff"
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle"
            >
              {year}
            </text>
          );
        })}

        {/* Links */}
        {processedData.links.map((link, index) => {
          const opacity = getLinkOpacity(link);
          const strokeWidth = Math.max(2, Math.min(link.value / 100, 8));
          const strokeColor = link.isEntry || link.isExit ? '#8b5cf6' : getRankChangeColor(link.rankChange);
          
          return (
            <g key={index}>
              <path
                d={generatePath(link)}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={opacity}
                filter={opacity > 0.8 ? "url(#linkGlow)" : "none"}
                className="transition-all duration-300"
              />
              
              {/* Rank change indicator */}
              {!link.isEntry && !link.isExit && opacity > 0.8 && (
                <text
                  x={(link.sourceNode.x + link.targetNode.x) / 2}
                  y={(link.sourceNode.y + link.targetNode.y) / 2 - 5}
                  fill={strokeColor}
                  fontSize="8"
                  textAnchor="middle"
                  className="font-bold"
                >
                  {link.rankChange > 0 ? `↓${link.rankChange}` : 
                   link.rankChange < 0 ? `↑${Math.abs(link.rankChange)}` : '→'}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {processedData.nodes.map(node => {
          const opacity = getNodeOpacity(node);
          const isSelected = selectedArtist === node.artist;
          const isHovered = hoveredNode?.id === node.id;
          
          return (
            <g key={node.id}>
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isSelected || isHovered ? 12 : 8}
                fill={node.color}
                stroke="#ffffff"
                strokeWidth={isSelected || isHovered ? 3 : 1}
                opacity={opacity}
                filter={opacity > 0.8 ? "url(#nodeGlow)" : "none"}
                className="cursor-pointer transition-all duration-300 hover:opacity-100"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedArtist(selectedArtist === node.artist ? null : node.artist)}
              />
              
              {/* Rank number */}
              <text
                x={node.x}
                y={node.y}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none"
                opacity={opacity}
              >
                {node.rank}
              </text>
              
              {/* Artist name */}
              <text
                x={node.x}
                y={node.y + 20}
                fill="#ffffff"
                fontSize="8"
                textAnchor="middle"
                className="pointer-events-none"
                opacity={opacity}
              >
                {node.artist.length > 12 ? node.artist.substring(0, 12) + '...' : node.artist}
              </text>
              
              {/* Previous year rank (instead of play count) */}
              <text
                x={node.x}
                y={node.y + 32}
                fill={node.color}
                fontSize="7"
                textAnchor="middle"
                className="pointer-events-none"
                opacity={opacity * 0.8}
              >
                {node.previousRank ? `#${node.previousRank}` : 'New'}
              </text>
            </g>
          );
        })}

        {/* Selected artist details */}
        {selectedArtist && (
          <g transform="translate(520, 80)">
            <rect width="160" height="140" fill="rgba(0, 0, 0, 0.9)" rx="8" stroke="#00f5ff" strokeWidth="2" />
            <text x="10" y="20" fill="#00f5ff" fontSize="14" fontWeight="bold">
              {selectedArtist}
            </text>
            <text x="10" y="35" fill="#ffffff" fontSize="10">
              Ranking Journey
            </text>
            
            {processedData.years.map((year, i) => {
              const node = processedData.nodes.find(n => n.artist === selectedArtist && n.year === year);
              if (!node) return null;
              
              return (
                <g key={year} transform={`translate(10, ${50 + i * 15})`}>
                  <circle cx="5" cy="5" r="3" fill={node.color} />
                  <text x="15" y="8" fill="#ffffff" fontSize="9">
                    {year}: #{node.rank} ({node.plays.toLocaleString()})
                  </text>
                </g>
              );
            })}
            
            <text x="10" y="130" fill="#gray" fontSize="8">
              Click artist to deselect
            </text>
          </g>
        )}

        {/* Hovered node details */}
        {hoveredNode && !selectedArtist && (
          <g transform="translate(520, 200)">
            <rect width="160" height="80" fill="rgba(0, 0, 0, 0.9)" rx="8" stroke={hoveredNode.color} strokeWidth="2" />
            <text x="10" y="20" fill={hoveredNode.color} fontSize="12" fontWeight="bold">
              {hoveredNode.artist}
            </text>
            <text x="10" y="40" fill="#ffffff" fontSize="10">
              {hoveredNode.year}: Rank #{hoveredNode.rank}
            </text>
            <text x="10" y="55" fill="#ffffff" fontSize="10">
              {hoveredNode.plays.toLocaleString()} plays
            </text>
            <text x="10" y="70" fill="#ffffff" fontSize="10">
              {hoveredNode.previousRank ? 
                `Prior year rank: #${hoveredNode.previousRank}` : 
                'Prior year rank: New entry'
              }
            </text>
          </g>
        )}
      </svg>

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 max-w-sm hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Artist Rankings Evolution</h4>
        <p className="text-gray-400 text-xs">
          Sankey diagram showing how your top 5 artists have changed ranks over the past 6 years.
          Follow the flowing paths to see artist trajectories, rises, and falls in your personal charts.
        </p>
      </div>
    </div>
  );
};

export default ArtistRankingSankey;
