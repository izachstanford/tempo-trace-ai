import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';

const ConcertStreamingHeatmap = ({ data, concertData, artistSummary }) => {
  const [selectedCell, setSelectedCell] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);

  const processedData = useMemo(() => {
    if (!concertData || !artistSummary || !data?.temporal_patterns?.yearly_breakdown) {
      return { heatmapData: [], artists: [], years: [], scales: null };
    }

    // Get all years from both concert data and yearly breakdown
    const concertYears = [...new Set(concertData.map(c => new Date(c.date).getFullYear()))].sort();
    const yearlyData = data.temporal_patterns.yearly_breakdown;
    const allYears = [...new Set([...Object.keys(yearlyData), ...concertYears])].sort();
    
    // Filter to only show concerts since 2016, but keep all years for average calculation
    const recentConcerts = concertData.filter(c => new Date(c.date).getFullYear() >= 2016);
    const recentConcertYears = [...new Set(recentConcerts.map(c => new Date(c.date).getFullYear()))].sort();
    
    // Get all artists that have both concert data and streaming data
    const concertArtists = [...new Set(recentConcerts.map(c => c.artist))];
    const streamingArtists = Object.keys(artistSummary);
    const artistsWithBoth = concertArtists.filter(artist => 
      streamingArtists.includes(artist) && artistSummary[artist]?.yearly_breakdown
    );

    if (artistsWithBoth.length === 0 || allYears.length === 0) {
      return { heatmapData: [], artists: [], years: [], scales: null };
    }

    // Calculate correlation data for each artist-year combination
    const heatmapData = [];
    const correlationData = [];

    artistsWithBoth.forEach(artist => {
      const artistData = artistSummary[artist];
      const artistConcertsList = recentConcerts.filter(c => c.artist === artist);
      const artistConcertYears = new Set(artistConcertsList.map(c => new Date(c.date).getFullYear()));
      
      // Use all years for average calculation, but only show recent concert years
      const displayYears = recentConcertYears.length > 0 ? recentConcertYears : allYears;
      
      displayYears.forEach(year => {
        const yearStreams = artistData.yearly_breakdown[year]?.streams || 0;
        const hasConcert = artistConcertYears.has(parseInt(year));
        const concertsInYear = artistConcertsList.filter(c => 
          new Date(c.date).getFullYear() === parseInt(year)
        );
        
        // Get concert info for this artist-year combination (if any concerts in this year)
        const concertInfo = concertsInYear.length > 0 ? concertsInYear[0] : null;
        
        // Calculate average streams for non-concert years using ALL historical data
        const nonConcertYears = allYears.filter(y => !artistConcertYears.has(parseInt(y)));
        const avgNonConcertStreams = nonConcertYears.length > 0 
          ? nonConcertYears.reduce((sum, y) => sum + (artistData.yearly_breakdown[y]?.streams || 0), 0) / nonConcertYears.length
          : 0;
        
        // Calculate correlation strength and percentage change for all years
        let correlationStrength = 0;
        let percentageChange = 0;
        
        if (avgNonConcertStreams > 0) {
          percentageChange = ((yearStreams - avgNonConcertStreams) / avgNonConcertStreams * 100);
          if (hasConcert) {
            correlationStrength = Math.max(0, Math.min(1, percentageChange / 100)); // Normalize to 0-1
          }
        }
        
        
        heatmapData.push({
          artist,
          concert: concertInfo?.concert || null,
          year,
          streams: yearStreams,
          hasConcert,
          concertCount: concertsInYear.length,
          avgNonConcertStreams,
          correlationStrength,
          increase: percentageChange
        });
        
        if (hasConcert) {
          correlationData.push({
            artist,
            year,
            increase: ((yearStreams - avgNonConcertStreams) / avgNonConcertStreams * 100),
            streams: yearStreams,
            avgStreams: avgNonConcertStreams
          });
        }
      });
    });

    // Create scales
    const width = 800;
    const height = 400;
    const margin = { top: 60, right: 20, bottom: 60, left: 120 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const xScale = d3.scaleBand()
      .domain(recentConcertYears.length > 0 ? recentConcertYears : allYears)
      .range([0, chartWidth])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(artistsWithBoth)
      .range([0, chartHeight])
      .padding(0.05);

    const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
      .domain([0, 1]);

    return { 
      heatmapData, 
      artists: artistsWithBoth, 
      years: allYears, 
      recentConcertYears,
      scales: { xScale, yScale, colorScale },
      correlationData,
      width,
      height,
      margin,
      chartWidth,
      chartHeight
    };
  }, [concertData, artistSummary, data]);

  const handleCellHover = (cellData, event) => {
    setSelectedCell(cellData);
    setTooltipData({
      x: event.clientX,
      y: event.clientY,
      data: cellData
    });
  };

  const handleCellLeave = () => {
    setSelectedCell(null);
    setTooltipData(null);
  };

  if (!processedData.heatmapData.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p>No concert-streaming correlation data available</p>
          <p className="text-sm mt-1">Need artists with both concert and streaming data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <svg width="100%" height="100%" viewBox={`0 0 ${processedData.width} ${processedData.height}`}>
        <defs>
          <filter id="cellGlow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background grid */}
        <g opacity="0.1">
          {(processedData.recentConcertYears.length > 0 ? processedData.recentConcertYears : processedData.years).map(year => (
            <line
              key={year}
              x1={processedData.scales.xScale(year) + processedData.margin.left}
              y1={processedData.margin.top}
              x2={processedData.scales.xScale(year) + processedData.margin.left}
              y2={processedData.height - processedData.margin.bottom}
              stroke="#ffffff"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}
        </g>

        {/* Year labels */}
        {(processedData.recentConcertYears.length > 0 ? processedData.recentConcertYears : processedData.years).map(year => (
          <text
            key={year}
            x={processedData.scales.xScale(year) + processedData.margin.left + processedData.scales.xScale.bandwidth() / 2}
            y={processedData.margin.top - 10}
            fill="#ffffff"
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
          >
            {year}
          </text>
        ))}

        {/* Artist labels */}
        {processedData.artists.map(artist => (
          <text
            key={artist}
            x={processedData.margin.left - 10}
            y={processedData.scales.yScale(artist) + processedData.margin.top + processedData.scales.yScale.bandwidth() / 2}
            fill="#ffffff"
            fontSize="10"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {artist.length > 15 ? artist.substring(0, 15) + '...' : artist}
          </text>
        ))}

        {/* Heatmap cells */}
        {processedData.heatmapData.map((cell, index) => {
          const x = processedData.scales.xScale(cell.year) + processedData.margin.left;
          const y = processedData.scales.yScale(cell.artist) + processedData.margin.top;
          const width = processedData.scales.xScale.bandwidth();
          const height = processedData.scales.yScale.bandwidth();
          
          const isSelected = selectedCell && selectedCell.artist === cell.artist && selectedCell.year === cell.year;
          const color = cell.hasConcert 
            ? processedData.scales.colorScale(cell.correlationStrength)
            : '#333333';
          
          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
                stroke={cell.hasConcert ? "#ffffff" : "#555555"}
                strokeWidth={isSelected ? 2 : 0.5}
                opacity={isSelected ? 1 : 0.8}
                filter={isSelected ? "url(#cellGlow)" : "none"}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={(e) => handleCellHover(cell, e)}
                onMouseLeave={handleCellLeave}
              />
              
              {/* Percentage change indicator for all cells */}
              <text
                x={x + width / 2}
                y={y + height / 2}
                fill={cell.hasConcert ? "#ffffff" : "#888888"}
                fontSize={Math.max(8, Math.min(width, height) / 6)}
                fontWeight={cell.hasConcert ? "bold" : "normal"}
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={cell.hasConcert ? 0.9 : 0.6}
                              >
                  {cell.increase > 0 ? '+' : cell.increase < 0 ? '-' : ''}{Math.abs(cell.increase).toFixed(0)}%
                </text>
            </g>
          );
        })}

        {/* Correlation summary */}
        <g transform={`translate(${processedData.margin.left}, ${processedData.height - processedData.margin.bottom + 20})`}>
          <text fill="#ffffff" fontSize="12" fontWeight="bold">
            Concert Impact Summary:
          </text>
          {(() => {
            const avgIncrease = processedData.correlationData.length > 0 
              ? processedData.correlationData.reduce((sum, d) => sum + d.increase, 0) / processedData.correlationData.length
              : 0;
            const positiveImpact = processedData.correlationData.filter(d => d.increase > 0).length;
            const totalConcerts = processedData.correlationData.length;
            
            return (
              <g transform="translate(0, 20)">
                <text fill="#00f5ff" fontSize="10">
                  Average increase: {avgIncrease > 0 ? '+' : ''}{avgIncrease.toFixed(1)}% during concert years
                </text>
                <text fill="#ffffff" fontSize="10" transform="translate(0, 15)">
                  {positiveImpact} of {totalConcerts} concerts increased streaming
                </text>
              </g>
            );
          })()}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <div 
          className="absolute bg-black/90 rounded-lg p-3 text-white text-xs pointer-events-none z-10"
          style={{
            left: tooltipData.x + 10,
            top: tooltipData.y - 10,
            maxWidth: '200px'
          }}
        >
          <div className="font-bold mb-1">{tooltipData.data.artist}</div>
          {tooltipData.data.concert && tooltipData.data.concert !== tooltipData.data.artist && (
            <div className="text-gray-400 text-xs mb-1">{tooltipData.data.concert}</div>
          )}
          <div>{tooltipData.data.year}</div>
          <div className="text-cyber-blue">
            {tooltipData.data.hasConcert ? (
              <>
                <div>🎵 Concert Year</div>
                <div>{tooltipData.data.streams.toLocaleString()} streams</div>
                {tooltipData.data.increase > 0 ? (
                  <div className="text-green-400">+{tooltipData.data.increase.toFixed(1)}% vs average</div>
                ) : (
                  <div className="text-red-400">{tooltipData.data.increase.toFixed(1)}% vs average</div>
                )}
              </>
            ) : (
              <>
                <div>📱 No Concert</div>
                <div>{tooltipData.data.streams.toLocaleString()} streams</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Info panel */}
      <div className="absolute bottom-4 right-4 bg-black/70 rounded-lg p-3 max-w-sm hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Concert Streaming Correlation</h4>
        <p className="text-gray-400 text-xs">
          Heatmap showing how concerts since 2016 affect streaming activity. Red = low correlation, blue = high correlation.
          Bold white text indicates concert years. Baseline includes full streaming history (2016-present). Hover for detailed stats.
        </p>
      </div>
    </div>
  );
};

export default ConcertStreamingHeatmap;
