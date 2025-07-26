import React, { useMemo, useState, useEffect } from 'react';
import * as d3 from 'd3';

const DiscoveryNostalgiaFlow = ({ data, artistSummary }) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [flowParticles, setFlowParticles] = useState([]);

  const processedData = useMemo(() => {
    if (!data?.temporal_patterns?.yearly_breakdown || !artistSummary) {
      return { timelineData: [], discoveryFlow: [], nostalgiaFlow: [], scales: null };
    }

    const yearlyData = data.temporal_patterns.yearly_breakdown;
    const years = Object.keys(yearlyData).sort();
    
    const timelineData = [];
    const discoveryFlow = [];
    const nostalgiaFlow = [];

    years.forEach((year, index) => {
      const yearData = yearlyData[year];
      
      // Calculate discovery vs nostalgia metrics
      const artistsInYear = Object.entries(artistSummary)
        .filter(([artist, artistData]) => {
          const firstPlayYear = new Date(artistData.first_played).getFullYear().toString();
          const lastPlayYear = new Date(artistData.last_played).getFullYear().toString();
          return firstPlayYear <= year && lastPlayYear >= year;
        });

      const newArtistsThisYear = Object.entries(artistSummary)
        .filter(([artist, artistData]) => {
          const firstPlayYear = new Date(artistData.first_played).getFullYear().toString();
          return firstPlayYear === year;
        }).length;

      const oldArtistsThisYear = artistsInYear.filter(([artist, artistData]) => {
        const firstPlayYear = new Date(artistData.first_played).getFullYear().toString();
        return firstPlayYear < year;
      }).length;

      const discoveryScore = artistsInYear.length > 0 ? (newArtistsThisYear / artistsInYear.length) * 100 : 0;
      const nostalgiaScore = artistsInYear.length > 0 ? (oldArtistsThisYear / artistsInYear.length) * 100 : 0;
      
      // Track diversity as exploration indicator
      const uniqueArtistsThisYear = artistsInYear.length;
      const totalPlaysThisYear = yearData.plays;
      const explorationRate = uniqueArtistsThisYear > 0 ? (totalPlaysThisYear / uniqueArtistsThisYear) : 0;
      
      const timePoint = {
        year,
        index,
        plays: yearData.plays,
        discoveryScore,
        nostalgiaScore,
        balance: discoveryScore - nostalgiaScore, // Positive = more discovery, negative = more nostalgia
        newArtists: newArtistsThisYear,
        oldArtists: oldArtistsThisYear,
        explorationRate,
        x: 50 + (index / (years.length - 1)) * 500,
        y: 200
      };

      timelineData.push(timePoint);

      // Create flow particles for discovery
      for (let i = 0; i < Math.min(newArtistsThisYear, 8); i++) {
        discoveryFlow.push({
          id: `discovery-${year}-${i}`,
          startX: timePoint.x,
          startY: 100, // Coming from discovery zone
          endX: timePoint.x,
          endY: timePoint.y,
          progress: Math.random(),
          speed: 0.008 + Math.random() * 0.012,
          size: 2 + Math.random() * 3,
          color: d3.interpolatePlasma(Math.random()),
          type: 'discovery',
          year,
          lifespan: Math.random() * 2 + 1
        });
      }

      // Create flow particles for nostalgia
      for (let i = 0; i < Math.min(Math.floor(oldArtistsThisYear / 2), 6); i++) {
        nostalgiaFlow.push({
          id: `nostalgia-${year}-${i}`,
          startX: timePoint.x,
          startY: 300, // Coming from nostalgia zone
          endX: timePoint.x,
          endY: timePoint.y,
          progress: Math.random(),
          speed: 0.006 + Math.random() * 0.01,
          size: 2 + Math.random() * 4,
          color: d3.interpolateWarm(Math.random()),
          type: 'nostalgia',
          year,
          lifespan: Math.random() * 2 + 1
        });
      }
    });

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, years.length - 1])
      .range([50, 550]);

    const discoveryScale = d3.scaleLinear()
      .domain([0, Math.max(...timelineData.map(d => d.discoveryScore))])
      .range([0, 80]);

    const nostalgiaScale = d3.scaleLinear()
      .domain([0, Math.max(...timelineData.map(d => d.nostalgiaScore))])
      .range([0, 80]);

    const balanceScale = d3.scaleLinear()
      .domain(d3.extent(timelineData, d => d.balance))
      .range([100, 300]);

    return {
      timelineData,
      discoveryFlow,
      nostalgiaFlow,
      scales: { xScale, discoveryScale, nostalgiaScale, balanceScale },
      years
    };
  }, [data, artistSummary]);

  // Animation for flowing particles
  useEffect(() => {
    if (!processedData.timelineData.length) return;

    const allParticles = [...processedData.discoveryFlow, ...processedData.nostalgiaFlow];
    setFlowParticles(allParticles);

    const interval = setInterval(() => {
      setAnimationFrame(prev => prev + 1);
    }, 60);

    return () => clearInterval(interval);
  }, [processedData]);

  // Update particle positions
  useEffect(() => {
    setFlowParticles(prevParticles =>
      prevParticles.map(particle => ({
        ...particle,
        progress: particle.progress + particle.speed > particle.lifespan
          ? 0 
          : particle.progress + particle.speed
      }))
    );
  }, [animationFrame]);

  const getParticlePosition = (particle) => {
    const t = particle.progress / particle.lifespan;
    const easeT = d3.easeCircleInOut(t);
    
    const x = particle.startX + (particle.endX - particle.startX) * easeT;
    const y = particle.startY + (particle.endY - particle.startY) * easeT;
    
    return { x, y };
  };

  const generateBalancePath = () => {
    if (!processedData.timelineData.length) return '';
    
    const line = d3.line()
      .x(d => d.x)
      .y(d => processedData.scales.balanceScale(d.balance))
      .curve(d3.curveCatmullRom);

    return line(processedData.timelineData);
  };

  if (!processedData.timelineData.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Loading discovery balance chart...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-gray-900 via-indigo-900 to-gray-900">
      <svg width="100%" height="100%" viewBox="0 0 600 400">
        <defs>
          <linearGradient id="discoveryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#065f46" stopOpacity="0.3"/>
          </linearGradient>
          <linearGradient id="nostalgiaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0.8"/>
          </linearGradient>
          <linearGradient id="balanceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.6"/>
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0.6"/>
          </linearGradient>
          <filter id="particleGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="pathGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background zones */}
        <rect x="0" y="0" width="600" height="150" fill="url(#discoveryGradient)" opacity="0.3" />
        <rect x="0" y="250" width="600" height="150" fill="url(#nostalgiaGradient)" opacity="0.3" />
        
        {/* Zone labels */}
        <text x="300" y="30" fill="#10b981" fontSize="16" fontWeight="bold" textAnchor="middle">
          DISCOVERY ZONE
        </text>
        <text x="300" y="50" fill="#10b981" fontSize="12" textAnchor="middle" opacity="0.8">
          New Artists & Exploration
        </text>
        
        <text x="300" y="370" fill="#dc2626" fontSize="16" fontWeight="bold" textAnchor="middle">
          COMFORT ZONE
        </text>
        <text x="300" y="390" fill="#dc2626" fontSize="12" textAnchor="middle" opacity="0.8">
          Familiar Favorites & Nostalgia
        </text>

        {/* Center equilibrium line */}
        <line x1="50" y1="200" x2="550" y2="200" stroke="#ffffff" strokeWidth="1" opacity="0.3" strokeDasharray="5,5" />
        <text x="560" y="205" fill="#ffffff" fontSize="10" opacity="0.6">Balance</text>

        {/* Flowing particles */}
        {flowParticles.map(particle => {
          const pos = getParticlePosition(particle);
          const opacity = 1 - (particle.progress / particle.lifespan);
          
          return (
            <circle
              key={particle.id}
              cx={pos.x}
              cy={pos.y}
              r={particle.size}
              fill={particle.color}
              opacity={opacity * 0.8}
              filter="url(#particleGlow)"
            />
          );
        })}

        {/* Balance path */}
        <path
          d={generateBalancePath()}
          fill="none"
          stroke="url(#balanceGradient)"
          strokeWidth="3"
          filter="url(#pathGlow)"
          className="animate-pulse"
        />

        {/* Timeline points */}
        {processedData.timelineData.map((point, index) => {
          const isSelected = selectedPeriod === point.year;
          const balanceY = processedData.scales.balanceScale(point.balance);
          
          // Determine point color based on balance
          let pointColor = '#8b5cf6'; // neutral purple
          if (point.balance > 10) pointColor = '#10b981'; // discovery green
          else if (point.balance < -10) pointColor = '#dc2626'; // nostalgia red

          return (
            <g key={point.year}>
              {/* Balance point */}
              <circle
                cx={point.x}
                cy={balanceY}
                r={isSelected ? 8 : 5}
                fill={pointColor}
                stroke="#ffffff"
                strokeWidth={isSelected ? 3 : 1}
                className="cursor-pointer transition-all duration-300 hover:r-7"
                onMouseEnter={() => setSelectedPeriod(point.year)}
                onMouseLeave={() => setSelectedPeriod(null)}
              />

              {/* Discovery indicator */}
              <rect
                x={point.x - 10}
                y={160 - processedData.scales.discoveryScale(point.discoveryScore)}
                width="20"
                height={processedData.scales.discoveryScale(point.discoveryScore)}
                fill="#10b981"
                opacity={isSelected ? 0.8 : 0.5}
                rx="2"
              />

              {/* Nostalgia indicator */}
              <rect
                x={point.x - 10}
                y={240}
                width="20"
                height={processedData.scales.nostalgiaScale(point.nostalgiaScore)}
                fill="#dc2626"
                opacity={isSelected ? 0.8 : 0.5}
                rx="2"
              />

              {/* Year label */}
              <text
                x={point.x}
                y={balanceY + (isSelected ? 25 : 20)}
                fill="#ffffff"
                fontSize={isSelected ? "12" : "10"}
                fontWeight={isSelected ? "bold" : "normal"}
                textAnchor="middle"
              >
                {point.year}
              </text>

              {/* New artists count */}
              <text
                x={point.x}
                y={140}
                fill="#10b981"
                fontSize="8"
                textAnchor="middle"
                opacity={isSelected ? 1 : 0.7}
              >
                +{point.newArtists}
              </text>
            </g>
          );
        })}

        {/* Selected period details */}
        {selectedPeriod && (() => {
          const point = processedData.timelineData.find(p => p.year === selectedPeriod);
          if (!point) return null;

          return (
            <g transform="translate(400, 80)">
              <rect width="180" height="100" fill="rgba(0, 0, 0, 0.9)" rx="8" stroke="#8b5cf6" strokeWidth="1" />
              <text x="10" y="20" fill="#ffffff" fontSize="14" fontWeight="bold">
                {point.year} Musical Balance
              </text>
              <text x="10" y="40" fill="#10b981" fontSize="10">
                Discovery: {Math.round(point.discoveryScore)}%
              </text>
              <text x="10" y="55" fill="#dc2626" fontSize="10">
                Nostalgia: {Math.round(point.nostalgiaScore)}%
              </text>
              <text x="10" y="70" fill="#ffffff" fontSize="10">
                New Artists: {point.newArtists}
              </text>
              <text x="10" y="85" fill="#ffffff" fontSize="10">
                Balance: {point.balance > 0 ? 'Discovery' : 'Comfort'} {Math.abs(Math.round(point.balance))}%
              </text>
            </g>
          );
        })()}

        {/* Legend */}
        <g transform="translate(20, 80)">
          <rect width="160" height="100" fill="rgba(0, 0, 0, 0.8)" rx="8" />
          <text x="10" y="20" fill="#ffffff" fontSize="12" fontWeight="bold">
            Musical Journey
          </text>
          
          <circle cx="20" cy="35" r="4" fill="#10b981" />
          <text x="30" y="39" fill="#ffffff" fontSize="9">Discovery Flow</text>
          
          <circle cx="20" cy="50" r="4" fill="#dc2626" />
          <text x="30" y="54" fill="#ffffff" fontSize="9">Comfort Flow</text>
          
          <line x1="15" y1="65" x2="25" y2="65" stroke="url(#balanceGradient)" strokeWidth="3" />
          <text x="30" y="69" fill="#ffffff" fontSize="9">Balance Path</text>
          
          <text x="10" y="85" fill="#8b5cf6" fontSize="8">
            Hover timeline points for details
          </text>
        </g>

        {/* Flow statistics */}
        <g transform="translate(450, 300)">
          <rect width="140" height="80" fill="rgba(0, 0, 0, 0.8)" rx="8" />
          <text x="10" y="20" fill="#ffffff" fontSize="12" fontWeight="bold">
            Overall Trends
          </text>
          
          {(() => {
            const avgDiscovery = processedData.timelineData.reduce((sum, p) => sum + p.discoveryScore, 0) / processedData.timelineData.length;
            const avgNostalgia = processedData.timelineData.reduce((sum, p) => sum + p.nostalgiaScore, 0) / processedData.timelineData.length;
            const totalNewArtists = processedData.timelineData.reduce((sum, p) => sum + p.newArtists, 0);
            
            return (
              <g>
                <text x="10" y="35" fill="#10b981" fontSize="9">
                  Avg Discovery: {Math.round(avgDiscovery)}%
                </text>
                <text x="10" y="50" fill="#dc2626" fontSize="9">
                  Avg Comfort: {Math.round(avgNostalgia)}%
                </text>
                <text x="10" y="65" fill="#ffffff" fontSize="9">
                  New Artists: {totalNewArtists}
                </text>
              </g>
            );
          })()}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-3 hidden md:block">
        <div className="text-cyber-blue text-xs font-semibold mb-2">Timeline View</div>
        <div className="text-gray-400 text-xs">
          <div>Years tracked: {processedData.years.length}</div>
          <div className="mt-1">
            Particles show real-time flow between discovery and comfort zones
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 max-w-sm hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Discovery vs. Nostalgia Balance</h4>
        <p className="text-gray-400 text-xs">
          The flowing path shows your balance between discovering new music (top) and revisiting
          favorites (bottom). Particles represent the actual flow of musical exploration over time.
        </p>
      </div>
    </div>
  );
};

export default DiscoveryNostalgiaFlow;
