import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';

const EmotionalListeningLandscape = ({ data, artistSummary }) => {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [viewAngle, setViewAngle] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState('intensity');

  const processedData = useMemo(() => {
    if (!data?.temporal_patterns?.hourly_breakdown || !artistSummary) {
      return { landscape: [], contours: [], peaks: [], valleys: [] };
    }

    const hourlyData = data.temporal_patterns.hourly_breakdown || {};
    const seasonalData = data.temporal_patterns.seasonal_breakdown || {};
    const weekdayData = data.temporal_patterns.weekday_breakdown || {};

    // Create a 24x7 grid (hours x days) for emotional landscape
    const landscape = [];
    const peaks = [];
    const valleys = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const dayPlayValues = Object.values(weekdayData).map(d => (d && d.plays) || 0);
    const maxDayPlays = dayPlayValues.length ? Math.max(...dayPlayValues, 1) : 1;
    const hourPlayValues = Object.values(hourlyData).map(h => (h && h.plays) || 0);
    const maxHourPlays = hourPlayValues.length ? Math.max(...hourPlayValues, 1) : 1;

    days.forEach((day, dayIndex) => {
      const dayData = weekdayData[day] || { plays: 0, ms_played: 0 };
      const dayIntensity = maxDayPlays ? (dayData.plays / maxDayPlays) : 0;

      Array.from({ length: 24 }, (_, hour) => {
        const hourData = hourlyData[hour] || { plays: 0, ms_played: 0 };
        const hourIntensity = maxHourPlays ? (hourData.plays / maxHourPlays) : 0;

        // Calculate emotional metrics
        let emotionalValence = 0.5; // neutral baseline
        let energy = 0.5;
        let mood = 'neutral';
        let color = '#666666';

        // Time-based emotional patterns
        if (hour >= 6 && hour <= 11) {
          // Morning - optimistic, building energy
          emotionalValence = 0.6 + Math.sin((hour - 6) / 5 * Math.PI) * 0.2;
          energy = 0.4 + (hour - 6) * 0.08;
          mood = 'optimistic';
          color = '#f59e0b';
        } else if (hour >= 12 && hour <= 17) {
          // Afternoon - peak energy, focus
          emotionalValence = 0.7 + Math.sin((hour - 12) / 5 * Math.PI) * 0.2;
          energy = 0.8 + Math.sin((hour - 12) / 5 * Math.PI) * 0.15;
          mood = 'energetic';
          color = '#dc2626';
        } else if (hour >= 18 && hour <= 22) {
          // Evening - social, relaxed
          emotionalValence = 0.6 + Math.cos((hour - 18) / 4 * Math.PI) * 0.2;
          energy = 0.7 - (hour - 18) * 0.08;
          mood = 'social';
          color = '#8b5cf6';
        } else {
          // Night - introspective, calm
          emotionalValence = 0.4 + Math.random() * 0.2;
          energy = 0.3 + Math.random() * 0.2;
          mood = 'introspective';
          color = '#3b82f6';
        }

        // Weekend vs weekday adjustments
        if (['Saturday', 'Sunday'].includes(day)) {
          emotionalValence += 0.1;
          if (hour >= 10 && hour <= 14) {
            energy += 0.1; // Weekend midday boost
          }
        }

        // Adjust based on actual listening data
        const listeningIntensity = hourIntensity * dayIntensity;
        energy *= (1 + listeningIntensity);
        emotionalValence *= (1 + listeningIntensity * 0.5);

        // Calculate elevation based on selected metric
        let elevation = 0;
        switch (selectedMetric) {
          case 'intensity':
            elevation = listeningIntensity * 100;
            break;
          case 'energy':
            elevation = energy * 100;
            break;
          case 'valence':
            elevation = emotionalValence * 100;
            break;
          default:
            elevation = listeningIntensity * 100;
        }

        const point = {
          x: hour * 20 + 50, // Scale to fit viewbox
          y: dayIndex * 40 + 50,
          z: elevation,
          hour,
          day,
          dayIndex,
          plays: hourData.plays,
          intensity: listeningIntensity,
          emotionalValence,
          energy,
          mood,
          color,
          // Calculate 3D projection
          projectedX: hour * 20 + 50 + Math.cos(viewAngle) * elevation * 0.3,
          projectedY: dayIndex * 40 + 50 - Math.sin(viewAngle) * elevation * 0.3 - elevation * 0.5
        };

        landscape.push(point);

        // Identify peaks and valleys
        if (elevation > 70) {
          peaks.push(point);
        } else if (elevation < 20) {
          valleys.push(point);
        }
      });
    });

    // Generate contour lines
    const contours = [];
    const elevationLevels = [20, 40, 60, 80];
    
    elevationLevels.forEach(level => {
      const contourPoints = landscape.filter(p => 
        Math.abs(p.z - level) < 10
      );
      contours.push({
        level,
        points: contourPoints,
        color: d3.interpolateViridis(level / 100)
      });
    });

    return { landscape, contours, peaks, valleys };
  }, [data, artistSummary, viewAngle, selectedMetric]);

  const generateMeshPath = (points, width = 24, height = 7) => {
    // Create triangulated mesh for 3D appearance
    let path = '';
    
    for (let i = 0; i < height - 1; i++) {
      for (let j = 0; j < width - 1; j++) {
        const topLeft = points[i * width + j];
        const topRight = points[i * width + j + 1];
        const bottomLeft = points[(i + 1) * width + j];
        const bottomRight = points[(i + 1) * width + j + 1];

        if (topLeft && topRight && bottomLeft && bottomRight) {
          // Create two triangles for each quad
          path += `M ${topLeft.projectedX} ${topLeft.projectedY} `;
          path += `L ${topRight.projectedX} ${topRight.projectedY} `;
          path += `L ${bottomLeft.projectedX} ${bottomLeft.projectedY} Z `;
          
          path += `M ${topRight.projectedX} ${topRight.projectedY} `;
          path += `L ${bottomRight.projectedX} ${bottomRight.projectedY} `;
          path += `L ${bottomLeft.projectedX} ${bottomLeft.projectedY} Z `;
        }
      }
    }
    
    return path;
  };

  const generateContourPath = (contourPoints) => {
    if (contourPoints.length < 3) return '';
    
    const line = d3.line()
      .x(d => d.projectedX)
      .y(d => d.projectedY)
      .curve(d3.curveBasis);

    return line(contourPoints);
  };

  if (!processedData.landscape.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Loading emotional landscape...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-gray-900 via-indigo-900 to-purple-900">
      <svg width="100%" height="100%" viewBox="0 0 700 400">
        <defs>
          <linearGradient id="terrainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.8"/> {/* High peaks - red */}
            <stop offset="25%" stopColor="#f59e0b" stopOpacity="0.6"/> {/* High - orange */}
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.4"/> {/* Medium - green */}
            <stop offset="75%" stopColor="#3b82f6" stopOpacity="0.3"/> {/* Low - blue */}
            <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.2"/> {/* Valleys - deep blue */}
          </linearGradient>
          
          <filter id="terrainShadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.3"/>
          </filter>
          
          <filter id="peakGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Gradient for elevation coloring */}
          <linearGradient id="elevationGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.8"/>
            <stop offset="20%" stopColor="#3b82f6" stopOpacity="0.7"/>
            <stop offset="40%" stopColor="#10b981" stopOpacity="0.6"/>
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.7"/>
            <stop offset="80%" stopColor="#dc2626" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.9"/>
          </linearGradient>
        </defs>

        {/* Background grid */}
        <g opacity="0.1">
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`h-${i}`} x1="50" y1={50 + i * 40} x2="530" y2={50 + i * 40} 
                  stroke="#ffffff" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 25 }, (_, i) => (
            <line key={`v-${i}`} x1={50 + i * 20} y1="50" x2={50 + i * 20} y2="330" 
                  stroke="#ffffff" strokeWidth="0.5" />
          ))}
        </g>

        {/* Terrain mesh */}
        <path
          d={generateMeshPath(processedData.landscape)}
          fill="url(#elevationGradient)"
          stroke="none"
          opacity="0.6"
          filter="url(#terrainShadow)"
        />

        {/* Contour lines */}
        {processedData.contours.map((contour, index) => (
          <path
            key={index}
            d={generateContourPath(contour.points)}
            fill="none"
            stroke={contour.color}
            strokeWidth="1.5"
            opacity="0.7"
          />
        ))}

        {/* Elevation points */}
        {processedData.landscape.map((point, index) => {
          const isSelected = selectedRegion && 
            selectedRegion.hour === point.hour && selectedRegion.dayIndex === point.dayIndex;
          const opacity = selectedRegion ? (isSelected ? 1 : 0.3) : (0.6 + (point.z / 100) * 0.4);
          const size = 2 + (point.z / 100) * 4;

          return (
            <circle
              key={index}
              cx={point.projectedX}
              cy={point.projectedY}
              r={size}
              fill={point.color}
              stroke="#ffffff"
              strokeWidth={isSelected ? 2 : 0.5}
              opacity={opacity}
              className="cursor-pointer transition-all duration-200 hover:opacity-100"
              onMouseEnter={() => setSelectedRegion(point)}
              onMouseLeave={() => setSelectedRegion(null)}
            />
          );
        })}

        {/* Peak markers */}
        {processedData.peaks.map((peak, index) => (
          <g key={`peak-${index}`}>
            <circle
              cx={peak.projectedX}
              cy={peak.projectedY}
              r="8"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              opacity="0.8"
              filter="url(#peakGlow)"
            />
            <text
              x={peak.projectedX}
              y={peak.projectedY - 12}
              fill="#fbbf24"
              fontSize="8"
              textAnchor="middle"
              className="font-bold"
            >
              ▲
            </text>
          </g>
        ))}

        {/* Valley markers */}
        {processedData.valleys.map((valley, index) => (
          <g key={`valley-${index}`}>
            <circle
              cx={valley.projectedX}
              cy={valley.projectedY}
              r="6"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              opacity="0.6"
            />
            <text
              x={valley.projectedX}
              y={valley.projectedY + 3}
              fill="#3b82f6"
              fontSize="8"
              textAnchor="middle"
            >
              ▼
            </text>
          </g>
        ))}

        {/* Time labels */}
        <g transform="translate(50, 40)">
          <text fill="#ffffff" fontSize="10" fontWeight="bold">Hours →</text>
          {[0, 6, 12, 18, 24].map(hour => (
            <text key={hour} x={hour * 20} y={-10} fill="#ffffff" fontSize="9" textAnchor="middle">
              {hour}:00
            </text>
          ))}
        </g>

        {/* Day labels */}
        <g transform="translate(30, 70)">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
            <text key={day} x="0" y={i * 40} fill="#ffffff" fontSize="9" textAnchor="end">
              {day}
            </text>
          ))}
          <text x="-20" y="-20" fill="#ffffff" fontSize="10" fontWeight="bold" 
                transform="rotate(-90, -20, -20)">Days ↑</text>
        </g>

        {/* Selected region details */}
        {selectedRegion && (
          <g transform="translate(550, 50)">
            <rect width="140" height="120" fill="rgba(0, 0, 0, 0.9)" rx="8" 
                  stroke={selectedRegion.color} strokeWidth="2" />
            <text x="10" y="20" fill={selectedRegion.color} fontSize="12" fontWeight="bold">
              {selectedRegion.day}
            </text>
            <text x="10" y="35" fill="#ffffff" fontSize="10">
              {selectedRegion.hour}:00 - {selectedRegion.hour + 1}:00
            </text>
            <text x="10" y="50" fill="#ffffff" fontSize="9">
              Mood: {selectedRegion.mood}
            </text>
            <text x="10" y="65" fill="#ffffff" fontSize="9">
              Energy: {Math.round(selectedRegion.energy * 100)}%
            </text>
            <text x="10" y="80" fill="#ffffff" fontSize="9">
              Valence: {Math.round(selectedRegion.emotionalValence * 100)}%
            </text>
            <text x="10" y="95" fill="#ffffff" fontSize="9">
              Plays: {selectedRegion.plays}
            </text>
            <text x="10" y="110" fill="#ffffff" fontSize="8">
              Elevation: {Math.round(selectedRegion.z)}
            </text>
          </g>
        )}

        {/* Legend */}
        <g transform="translate(20, 50)">
          <rect width="140" height="140" fill="rgba(0, 0, 0, 0.8)" rx="8" />
          <text x="10" y="20" fill="#ffffff" fontSize="12" fontWeight="bold">
            Emotional Terrain
          </text>
          
          {/* Elevation legend */}
          <rect x="10" y="30" width="15" height="80" fill="url(#elevationGradient)" />
          <text x="30" y="35" fill="#ffffff" fontSize="8">High</text>
          <text x="30" y="70" fill="#ffffff" fontSize="8">Medium</text>
          <text x="30" y="105" fill="#ffffff" fontSize="8">Low</text>
          
          {/* Markers legend */}
          <text x="70" y="35" fill="#fbbf24" fontSize="12">▲</text>
          <text x="80" y="39" fill="#ffffff" fontSize="8">Peak</text>
          
          <text x="70" y="50" fill="#3b82f6" fontSize="12">▼</text>
          <text x="80" y="54" fill="#ffffff" fontSize="8">Valley</text>
          
          {/* Mood colors */}
          <text x="10" y="125" fill="#ffffff" fontSize="8" fontWeight="semibold">Moods:</text>
          <circle cx="20" cy="135" r="3" fill="#f59e0b" />
          <text x="28" y="138" fill="#ffffff" fontSize="7">Morning</text>
          <circle cx="70" cy="135" r="3" fill="#dc2626" />
          <text x="78" y="138" fill="#ffffff" fontSize="7">Peak</text>
          <circle cx="110" cy="135" r="3" fill="#8b5cf6" />
          <text x="118" y="138" fill="#ffffff" fontSize="7">Evening</text>
        </g>

        {/* Metric selector visualization */}
        <g transform="translate(550, 200)">
          <rect width="140" height="80" fill="rgba(0, 0, 0, 0.8)" rx="8" />
          <text x="10" y="20" fill="#ffffff" fontSize="12" fontWeight="bold">
            Terrain Mode
          </text>
          <text x="10" y="40" fill="#00f5ff" fontSize="10">
            Current: {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
          </text>
          <text x="10" y="55" fill="#ffffff" fontSize="8">
            Click to change:
          </text>
          <text x="10" y="68" fill="#ffffff" fontSize="8">
            Intensity • Energy • Valence
          </text>
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-3 hidden md:block">
        <div className="text-cyber-blue text-xs font-semibold mb-2">View Controls</div>
        
        <div className="mb-3">
          <label className="block text-xs text-gray-300 mb-1">Elevation Metric:</label>
          <select 
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="text-xs bg-gray-800 text-white rounded px-2 py-1"
          >
            <option value="intensity">Listening Intensity</option>
            <option value="energy">Energy Level</option>
            <option value="valence">Emotional Valence</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-300 mb-1">3D Angle:</label>
          <input
            type="range"
            min="0"
            max={Math.PI * 2}
            step="0.1"
            value={viewAngle}
            onChange={(e) => setViewAngle(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 max-w-sm hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Emotional Listening Landscape</h4>
        <p className="text-gray-400 text-xs">
          3D topographic view of your emotional listening patterns across time. Peaks show high-activity
          periods, valleys show quiet times. Hover over points for detailed mood analysis.
        </p>
      </div>
    </div>
  );
};

export default EmotionalListeningLandscape;
