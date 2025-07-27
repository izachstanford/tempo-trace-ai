import React, { useMemo, useState, useEffect } from 'react';
import * as d3 from 'd3';

const GlobalMusicMap = ({ data }) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [particles, setParticles] = useState([]);

  // Country coordinates (simplified world map positions)
  const countryCoordinates = {
    'US': { x: 200, y: 180, name: 'United States' },
    'BE': { x: 380, y: 150, name: 'Belgium' },
    'NZ': { x: 620, y: 280, name: 'New Zealand' },
    'GB': { x: 360, y: 130, name: 'United Kingdom' },
    'IS': { x: 340, y: 110, name: 'Iceland' },
    'CZ': { x: 390, y: 140, name: 'Czech Republic' },
    'NO': { x: 380, y: 110, name: 'Norway' },
    'SE': { x: 390, y: 110, name: 'Sweden' },
    'BR': { x: 250, y: 230, name: 'Brazil' },
    'DK': { x: 380, y: 125, name: 'Denmark' },
    'BS': { x: 220, y: 170, name: 'Bahamas' },
    'IE': { x: 350, y: 130, name: 'Ireland' },
    'FR': { x: 370, y: 150, name: 'France' },
    'CH': { x: 380, y: 150, name: 'Switzerland' },
    'HU': { x: 400, y: 150, name: 'Hungary' }
  };

  const processedData = useMemo(() => {
    if (!data?.geographical_stats?.distribution) {
      return { countries: [], maxPlays: 0, totalPlays: 0 };
    }

    const distribution = data.geographical_stats.distribution;
    const countries = Object.entries(distribution)
      .filter(([code]) => countryCoordinates[code])
      .map(([code, plays]) => ({
        code,
        name: countryCoordinates[code].name,
        plays,
        x: countryCoordinates[code].x,
        y: countryCoordinates[code].y,
        percentage: (plays / data.content_stats.total_plays) * 100
      }))
      .sort((a, b) => b.plays - a.plays);

    const maxPlays = Math.max(...countries.map(c => c.plays));
    const totalPlays = countries.reduce((sum, c) => sum + c.plays, 0);

    return { countries, maxPlays, totalPlays };
  }, [data]);

  // Generate flowing particles between countries
  useEffect(() => {
    if (processedData.countries.length < 2) return;

    const generateParticles = () => {
      const newParticles = [];
      const primaryCountry = processedData.countries[0]; // US (highest plays)
      
      processedData.countries.slice(1, 6).forEach((country, index) => {
        // Create particles flowing from secondary countries to primary
        for (let i = 0; i < Math.min(country.plays / 1000, 5); i++) {
          newParticles.push({
            id: `${country.code}-${i}`,
            startX: country.x,
            startY: country.y,
            endX: primaryCountry.x,
            endY: primaryCountry.y,
            progress: Math.random(),
            speed: 0.005 + Math.random() * 0.01,
            size: 2 + Math.random() * 3,
            color: d3.interpolateViridis(index / 5),
            country: country.code
          });
        }
      });

      return newParticles;
    };

    setParticles(generateParticles());
    
    const interval = setInterval(() => {
      setAnimationFrame(prev => prev + 1);
    }, 50);

    return () => clearInterval(interval);
  }, [processedData.countries]);

  // Update particle positions
  useEffect(() => {
    setParticles(prevParticles => 
      prevParticles.map(particle => ({
        ...particle,
        progress: particle.progress + particle.speed > 1 
          ? 0 
          : particle.progress + particle.speed
      }))
    );
  }, [animationFrame]);

  const getCountryRadius = (plays, maxPlays) => {
    return Math.max(5, (plays / maxPlays) * 25);
  };

  const getParticlePosition = (particle) => {
    const t = particle.progress;
    const x = particle.startX + (particle.endX - particle.startX) * t;
    const y = particle.startY + (particle.endY - particle.startY) * t;
    return { x, y };
  };

  if (!processedData.countries.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Loading global music map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-gray-900 via-blue-900 to-gray-900">
      <svg width="100%" height="100%" viewBox="0 0 700 400">
        <defs>
          <radialGradient id="countryGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.8"/>
            <stop offset="70%" stopColor="#00f5ff" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#00f5ff" stopOpacity="0"/>
          </radialGradient>
          <filter id="particleGlow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="countryBloom">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* World map background (simplified continents) */}
        <g opacity="0.1" stroke="#ffffff" strokeWidth="0.5" fill="none">
          {/* North America */}
          <path d="M50 120 Q120 100 200 120 L220 140 Q240 160 220 180 L200 200 Q150 220 100 200 Q60 180 50 120Z" />
          {/* Europe */}
          <path d="M320 100 Q400 90 450 120 L440 160 Q420 170 380 160 L340 140 Q320 120 320 100Z" />
          {/* Asia */}
          <path d="M450 100 Q550 80 600 120 L580 180 Q520 200 480 180 L460 140 Q450 120 450 100Z" />
          {/* Oceania */}
          <path d="M580 250 Q630 240 660 260 L650 280 Q620 290 590 280 L580 270 Q580 250 580 250Z" />
          {/* South America */}
          <path d="M200 200 Q240 210 260 240 L250 290 Q220 310 200 280 L180 240 Q190 220 200 200Z" />
        </g>

        {/* Connection lines between countries */}
        {selectedCountry ? 
          processedData.countries
            .filter(c => c.code !== selectedCountry && c !== processedData.countries[0])
            .map(country => {
              const primary = processedData.countries.find(c => c.code === selectedCountry);
              return (
                <line
                  key={`connection-${country.code}`}
                  x1={primary.x}
                  y1={primary.y}
                  x2={country.x}
                  y2={country.y}
                  stroke="#00f5ff"
                  strokeWidth="1"
                  opacity="0.3"
                  strokeDasharray="2,2"
                />
              );
            }) : 
          // Show connections to primary country (US)
          processedData.countries.slice(1, 6).map(country => (
            <line
              key={`connection-${country.code}`}
              x1={processedData.countries[0].x}
              y1={processedData.countries[0].y}
              x2={country.x}
              y2={country.y}
              stroke="#00f5ff"
              strokeWidth="0.5"
              opacity="0.2"
              strokeDasharray="1,1"
            />
          ))
        }

        {/* Animated particles */}
        {particles.map(particle => {
          const pos = getParticlePosition(particle);
          return (
            <circle
              key={particle.id}
              cx={pos.x}
              cy={pos.y}
              r={particle.size}
              fill={particle.color}
              opacity={1 - particle.progress}
              filter="url(#particleGlow)"
              className="animate-pulse"
            />
          );
        })}

        {/* Country nodes */}
        {processedData.countries.map((country, index) => {
          const radius = getCountryRadius(country.plays, processedData.maxPlays);
          const isSelected = selectedCountry === country.code;
          const isPrimary = index === 0;
          
          return (
            <g key={country.code}>
              {/* Glow effect */}
              <circle
                cx={country.x}
                cy={country.y}
                r={radius * 1.5}
                fill="url(#countryGlow)"
                opacity={isSelected ? 0.8 : 0.3}
                className={isPrimary ? 'animate-pulse' : ''}
              />
              
              {/* Main country circle */}
              <circle
                cx={country.x}
                cy={country.y}
                r={radius}
                fill={isPrimary ? '#ff0080' : '#00f5ff'}
                stroke="#ffffff"
                strokeWidth={isSelected ? '3' : '1'}
                opacity={isSelected ? 1 : 0.8}
                filter="url(#countryBloom)"
                className="cursor-pointer transition-all duration-300 hover:opacity-100"
                onMouseEnter={() => setSelectedCountry(country.code)}
                onMouseLeave={() => setSelectedCountry(null)}
              />

              {/* Play count indicator */}
              <text
                x={country.x}
                y={country.y}
                fill="#ffffff"
                fontSize={Math.max(8, Math.min(12, radius / 2))}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none font-bold"
              >
                {country.plays > 999 ? `${Math.round(country.plays/1000)}k` : country.plays}
              </text>

              {/* Country label */}
              <text
                x={country.x}
                y={country.y + radius + 15}
                fill="#ffffff"
                fontSize="10"
                textAnchor="middle"
                className="pointer-events-none"
                opacity={isSelected ? 1 : 0.7}
              >
                {country.code}
              </text>
            </g>
          );
        })}

        {/* Selected country info */}
        {selectedCountry && (
          <g transform="translate(500, 20)">
            {(() => {
              const country = processedData.countries.find(c => c.code === selectedCountry);
              return (
                <g>
                  <rect width="180" height="100" fill="rgba(0, 0, 0, 0.8)" rx="8" />
                  <text x="10" y="20" fill="#00f5ff" fontSize="14" fontWeight="bold">
                    {country.name}
                  </text>
                  <text x="10" y="40" fill="#ffffff" fontSize="12">
                    {country.plays.toLocaleString()} plays
                  </text>
                  <text x="10" y="55" fill="#ffffff" fontSize="10">
                    {country.percentage.toFixed(1)}% of total listening
                  </text>
                  <text x="10" y="75" fill="#gray" fontSize="9">
                    Rank #{processedData.countries.findIndex(c => c.code === selectedCountry) + 1}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 bg-black/70 rounded-lg p-3 hidden md:block">
        <div className="text-cyber-blue text-xs font-semibold mb-2">Time Zones</div>
        <div className="text-gray-400 text-xs">
          <div>Most active: {data?.geographical_stats?.top_countries?.[0]?.[0]} timezone</div>
          <div className="mt-1">
            {processedData.countries.length} countries tracked
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 max-w-xs hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Global Music Journey</h4>
        <p className="text-gray-400 text-xs">
          Circle size represents play count. Particles flow between listening locations.
          Hover over countries for detailed statistics.
        </p>
      </div>
    </div>
  );
};

export default GlobalMusicMap;
