import React, { useMemo } from 'react';
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
import { Circle } from 'lucide-react';
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

const ConcertTrendsMultiChart = ({ streamingData, concertData, artistSummary }) => {
  // Get all concerts from 2016 to present (filter out pre-2016 concerts)
  const allConcerts = useMemo(() => {
    if (!concertData) return [];
    return concertData.filter(concert => 
      concert.date && 
      concert.artist && 
      parseISO(concert.date).getFullYear() >= 2016
    );
  }, [concertData]);

  // Get top 10 artists by total streams who have been seen in concert
  const topConcertArtists = useMemo(() => {
    if (!artistSummary || !allConcerts.length) return [];
    
    const concertArtists = [...new Set(allConcerts.map(c => c.artist))];
    const artistsWithConcerts = Object.entries(artistSummary)
      .filter(([name, data]) => 
        concertArtists.includes(name) && 
        data.yearly_breakdown && 
        data.total_streams > 0
      )
      .map(([name, data]) => ({
        name,
        totalStreams: data.total_streams || 0,
        totalHours: data.total_hours || 0
      }))
      .sort((a, b) => b.totalStreams - a.totalStreams)
      .slice(0, 10);
    
    return artistsWithConcerts;
  }, [artistSummary, allConcerts]);

  // Create chart data for all top artists
  const createMultiArtistChartData = () => {
    const datasets = [];
    const colors = [
      '#00f5ff', '#f472b6', '#a855f7', '#10b981', '#f59e0b',
      '#ef4444', '#06b6d4', '#8b5cf6', '#84cc16', '#f97316'
    ];
    
    topConcertArtists.forEach((artist, index) => {
      const artistConcerts = allConcerts.filter(concert => concert.artist === artist.name);
      
      if (artistSummary && artistSummary[artist.name] && artistSummary[artist.name].yearly_breakdown) {
        const yearlyBreakdown = artistSummary[artist.name].yearly_breakdown;
        
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
          concertYears.includes(parseInt(year)) ? '#f472b6' : colors[index % colors.length]
        );
        const pointSizes = labels.map(year => 
          concertYears.includes(parseInt(year)) ? 12 : 4
        );
        
        datasets.push({
          label: artist.name,
          data: chartData,
          borderColor: colors[index % colors.length],
          backgroundColor: `${colors[index % colors.length]}20`,
          fill: false,
          pointStyle: pointStyles,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: pointSizes,
          pointBorderWidth: labels.map(year => 
            concertYears.includes(parseInt(year)) ? 3 : 1
          ),
          tension: 0.3
        });
      }
    });
    
    // Get common labels from the first dataset
    const labels = datasets.length > 0 ? 
      Object.keys(artistSummary[topConcertArtists[0].name].yearly_breakdown || {}).sort() : 
      [];
    
    return {
      labels: labels.map(year => year.toString()),
      datasets
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#ffffff',
          usePointStyle: true,
          padding: 10,
          font: {
            size: 10
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        titleColor: '#00f5ff',
        bodyColor: '#ffffff',
        borderColor: '#00f5ff',
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)} hours`
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

  if (topConcertArtists.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p>No artists with both concert and streaming data</p>
          <p className="text-sm mt-1">Need artists you've seen in concert with streaming history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="chart-container" style={{ height: '400px' }}>
        <Line 
          data={createMultiArtistChartData()} 
          options={chartOptions}
        />
      </div>
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Circle className="w-3 h-3 text-cyber-blue" />
        <span>Regular listening</span>
        <div className="w-4 h-4 bg-cyber-pink rotate-45 ml-4 border-2 border-white"></div>
        <span className="font-semibold text-cyber-pink">Concert year</span>
      </div>
    </div>
  );
};

export default ConcertTrendsMultiChart; 