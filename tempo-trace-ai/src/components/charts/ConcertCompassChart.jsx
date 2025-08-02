import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { TrendingUp, Circle } from 'lucide-react';
import { parseISO } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Helper function to get full year range from data
const getFullYearRange = (data, artistSummary) => {
  if (data && data.length > 0) {
    const dates = data.map(item => parseISO(item.ts));
    const startYear = Math.min(...dates.map(d => d.getFullYear()));
    const endYear = Math.max(...dates.map(d => d.getFullYear()));
    return { startYear, endYear };
  }
  
  // Fallback to artistSummary data
  if (artistSummary) {
    const allYears = [];
    Object.values(artistSummary).forEach(artist => {
      if (artist.yearly_breakdown) {
        allYears.push(...Object.keys(artist.yearly_breakdown).map(year => parseInt(year)));
      }
    });
    
    if (allYears.length > 0) {
      return { startYear: Math.min(...allYears), endYear: Math.max(...allYears) };
    }
  }
  
  return { startYear: 2016, endYear: new Date().getFullYear() };
};

const ConcertCompassChart = ({ streamingData, concertData, artistSummary }) => {
  const [selectedArtist, setSelectedArtist] = useState(null);
  
  // Get all concerts from 2016 to present (filter out pre-2016 concerts)
  const allConcerts = useMemo(() => {
    if (!concertData) return [];
    return concertData.filter(concert => 
      concert.date && 
      concert.artist && 
      parseISO(concert.date).getFullYear() >= 2016
    );
  }, [concertData]);

  // Get unique artists from all concerts for the dropdown
  const uniqueConcertArtists = [...new Set(allConcerts.map(c => c.artist))].sort();

  // Default to first artist when component loads
  React.useEffect(() => {
    if (uniqueConcertArtists.length > 0 && !selectedArtist) {
      setSelectedArtist(uniqueConcertArtists[0]);
    }
  }, [uniqueConcertArtists, selectedArtist]);

  // Create artist chart data
  const createArtistChartData = (artistName) => {
    const artistConcerts = allConcerts.filter(concert => concert.artist === artistName);
    
    // Try to get actual yearly data from artistSummary
    if (artistSummary && artistSummary[artistName] && artistSummary[artistName].yearly_breakdown) {
      const yearlyBreakdown = artistSummary[artistName].yearly_breakdown;
      
      // Get the complete year range from 2016 to present
      const { startYear, endYear } = getFullYearRange(streamingData, artistSummary);
      const displayStartYear = Math.max(2016, startYear);
      
      // Create yearly data for the complete range
      const yearlyData = {};
      for (let year = displayStartYear; year <= endYear; year++) {
        yearlyData[year] = yearlyBreakdown[year]?.hours || 0;
      }
      
      const labels = Object.keys(yearlyData).sort();
      const chartData = labels.map(year => yearlyData[year]);
      
      // Mark concert years (allow multiple per artist)
      const concertYears = [...new Set(artistConcerts.map(concert => parseISO(concert.date).getFullYear()))];
      const pointStyles = labels.map(year => 
        concertYears.includes(parseInt(year)) ? 'rectRot' : 'circle'
      );
      const pointColors = labels.map(year => 
        concertYears.includes(parseInt(year)) ? '#f472b6' : '#00f5ff'
      );
      const pointSizes = labels.map(year => 
        concertYears.includes(parseInt(year)) ? 8 : 4
      );
      
      return {
        labels: labels.map(year => year.toString()),
        datasets: [{
          label: 'Hours Listened',
          data: chartData,
          borderColor: '#00f5ff',
          backgroundColor: 'rgba(0, 245, 255, 0.1)',
          fill: true,
          pointStyle: pointStyles,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: pointSizes,
          tension: 0.3
        }],
        concerts: artistConcerts
      };
    }
    
    return null;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        titleColor: '#00f5ff',
        bodyColor: '#ffffff',
        borderColor: '#00f5ff',
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.parsed.y.toFixed(1)} hours`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff'
        },
        title: {
          display: true,
          text: 'Hours Listened',
          color: '#ffffff'
        }
      }
    }
  };

  if (!allConcerts.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p>No concert data available</p>
          <p className="text-sm mt-1">Need concert data to show trends</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <select 
          value={selectedArtist || ''} 
          onChange={(e) => setSelectedArtist(e.target.value || null)}
          className="cyber-input w-full"
        >
          <option value="">Select an artist...</option>
          {uniqueConcertArtists.map(artist => (
            <option key={artist} value={artist}>
              {artist}
            </option>
          ))}
        </select>
      </div>

      {selectedArtist && (
        <div className="space-y-4">
          <div className="chart-container" style={{ height: '300px' }}>
            <Line 
              data={createArtistChartData(selectedArtist)} 
              options={chartOptions}
            />
          </div>
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <Circle className="w-3 h-3 text-cyber-blue" />
            <span>Regular listening</span>
            <div className="w-3 h-3 bg-cyber-pink rotate-45 ml-4"></div>
            <span>Concert year</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcertCompassChart; 