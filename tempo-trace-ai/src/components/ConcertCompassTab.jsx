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
import { 
  Calendar, 
  Music, 
  TrendingUp, 
  MapPin, 
  Star, 
  CheckCircle, 
  Circle,
  Users,
  Clock
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, addMonths, subMonths } from 'date-fns';
import { formatNumber, formatTimeToReadable, generateMonthlyData, getTopByTime } from '../utils/dataUtils';

// Helper function to generate yearly data
const generateYearlyData = (data, startDate, endDate) => {
  const yearlyData = {};
  
  // Initialize all years in range
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  for (let year = startYear; year <= endYear; year++) {
    yearlyData[year] = 0;
  }
  
  // Aggregate data by year
  data.forEach(item => {
    const itemDate = parseISO(item.ts);
    const year = itemDate.getFullYear();
    
    if (yearlyData.hasOwnProperty(year)) {
      yearlyData[year] += item.ms_played;
    }
  });
  
  return yearlyData;
};

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
  
  return { startYear: new Date().getFullYear(), endYear: new Date().getFullYear() };
};

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

const ConcertCompassTab = ({ streamingData, concertData, artistSummary }) => {
  const [selectedArtist, setSelectedArtist] = useState(null);
  
  // If streamingData is not available, use annual recaps for year range
  const processedStreamingData = useMemo(() => {
    if (streamingData && streamingData.length > 0) {
      return streamingData;
    }
    
    // Return empty array - we'll use artistSummary.yearly_breakdown directly
    return [];
  }, [streamingData]);
  
  // Get top 20 artists by listening time
  const topArtists = useMemo(() => {
    if (processedStreamingData && processedStreamingData.length > 0) {
      return getTopByTime(processedStreamingData, 'artist_name', 20);
    }
    
    // Fallback to artistSummary
    if (artistSummary) {
      return Object.entries(artistSummary)
        .map(([name, data]) => ({
          name,
          time: data.total_hours * 60 * 60 * 1000,
          count: data.total_streams
        }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 20);
    }
    
    return [];
  }, [processedStreamingData, artistSummary]);

  // Get artists with concerts since 2016 (filter out null dates and pre-2016 concerts)
  const concertArtists = useMemo(() => {
    if (!concertData) return [];
    return concertData.filter(concert => 
      concert.date && 
      concert.artist && 
      parseISO(concert.date).getFullYear() >= 2016
    );
  }, [concertData]);

  // Get unique artists from concerts for the dropdown (only those with streaming data)
  const uniqueConcertArtists = [...new Set(concertArtists.map(c => c.artist))]
    .filter(artist => artistSummary && artistSummary[artist] && artistSummary[artist].yearly_breakdown)
    .sort();

  // Default to Fall Out Boy when tab is activated
  React.useEffect(() => {
    if (uniqueConcertArtists.length > 0 && !selectedArtist) {
      if (uniqueConcertArtists.includes('Fall Out Boy')) {
        setSelectedArtist('Fall Out Boy');
      }
    }
  }, [uniqueConcertArtists, selectedArtist]);

  // Create artist chart data
  const createArtistChartData = (artistName) => {
    const artistConcerts = concertArtists.filter(concert => concert.artist === artistName);
    
    // Try to get actual yearly data from artistSummary
    if (artistSummary && artistSummary[artistName] && artistSummary[artistName].yearly_breakdown) {
      const yearlyBreakdown = artistSummary[artistName].yearly_breakdown;
      
      // Get the complete year range from annual recaps or all streaming data
      const { startYear, endYear } = getFullYearRange(processedStreamingData, artistSummary);
      
      // Create yearly data for the complete range
      const yearlyData = {};
      for (let year = startYear; year <= endYear; year++) {
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
    
    // Fallback to processed streaming data if available
    const artistStreams = processedStreamingData.filter(item => item.artist_name === artistName);
    
    if (artistStreams.length > 0) {
      // Use complete year range from all data to show full trend
      const concertDates = artistConcerts.map(c => parseISO(c.date)).sort((a, b) => a - b);
      const { startYear, endYear } = getFullYearRange(processedStreamingData, artistSummary);
      const fullStartDate = new Date(startYear, 0, 1);
      const fullEndDate = new Date(endYear, 11, 31);
      
      // Generate yearly listening data for the complete range
      const yearlyData = generateYearlyData(artistStreams, fullStartDate, fullEndDate);
      
      // Convert to chart format
      const labels = Object.keys(yearlyData).sort();
      const data = labels.map(year => yearlyData[year] / (1000 * 60 * 60)); // Convert to hours
      
      // Mark concert years (allow multiple per artist)
      const concertYears = [...new Set(concertDates.map(date => date.getFullYear()))];
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
          data: data,
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

  const bucketListData = useMemo(() => {
    return topArtists.map(artist => {
      const hasSeenLive = concertArtists.some(concert => concert.artist === artist.name);
      return {
        ...artist,
        hasSeenLive
      };
    });
  }, [topArtists, concertArtists]);

  const seenLiveCount = bucketListData.filter(artist => artist.hasSeenLive).length;
  const bucketListProgress = bucketListData.length > 0 ? (seenLiveCount / bucketListData.length) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold font-cyber mb-4">
          <span className="bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
            Concert Compass
          </span>
        </h1>
        <p className="text-gray-400 text-lg">
          Discover how concerts impact your listening habits
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Concert Impact Chart */}
        <div className="cyber-card p-6">
          <h3 className="text-xl font-bold text-cyber-blue mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Concert Impact Analysis
          </h3>
          
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

        {/* Bucket List */}
        <div className="cyber-card p-6">
          <h3 className="text-xl font-bold text-cyber-purple mb-4 flex items-center gap-2">
            <Music className="w-5 h-5" />
            Bucket List Progress
          </h3>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300">Artists Seen Live</span>
              <span className="text-cyber-purple font-bold">{seenLiveCount}/20</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-cyber-purple to-cyber-pink h-3 rounded-full transition-all duration-500"
                style={{ width: `${bucketListProgress}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {bucketListProgress.toFixed(1)}% of your top 20 artists
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {bucketListData.map((artist, index) => (
              <div 
                key={artist.name} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 hover:bg-gradient-to-r ${
                  artist.hasSeenLive 
                    ? 'hover:from-cyber-green/10 hover:to-transparent' 
                    : 'hover:from-cyber-purple/10 hover:to-transparent'
                }`}
              >
                <div className="flex-shrink-0">
                  {artist.hasSeenLive ? (
                    <CheckCircle className="w-5 h-5 text-cyber-green" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{artist.name}</div>
                  <div className="text-gray-400 text-sm">
                    {formatTimeToReadable(artist.time)} • {formatNumber(artist.count)} plays
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-cyber-blue font-bold">#{index + 1}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Concert History */}
      <div className="cyber-card p-6">
        <h3 className="text-xl font-bold text-cyber-pink mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Concert History
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {concertArtists
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((concert, index) => (
              <div key={index} className="bg-gradient-to-br from-card-bg to-border-glow p-4 rounded-lg border border-cyber-pink/20">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-white">{concert.artist}</div>
                    <div className="text-sm text-gray-400">{concert.venue}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-gray-300">{concert.vibe_rating || 'N/A'}</span>
                  </div>
                </div>
                <div className="text-sm text-cyber-pink">
                  {format(parseISO(concert.date), 'MMM dd, yyyy')}
                </div>
                <div className="text-xs text-gray-500 mt-1 capitalize">
                  {concert.type}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="cyber-card p-6 text-center">
          <div className="text-3xl font-bold text-cyber-blue mb-2">
            {concertArtists.length}
          </div>
          <div className="text-gray-400">Concerts Attended</div>
        </div>
        
        <div className="cyber-card p-6 text-center">
          <div className="text-3xl font-bold text-cyber-purple mb-2">
            {new Set(concertArtists.map(c => c.artist)).size}
          </div>
          <div className="text-gray-400">Unique Artists</div>
        </div>
        
        <div className="cyber-card p-6 text-center">
          <div className="text-3xl font-bold text-cyber-pink mb-2">
            {new Set(concertArtists.map(c => c.venue)).size}
          </div>
          <div className="text-gray-400">Venues Visited</div>
        </div>
        
        <div className="cyber-card p-6 text-center">
          <div className="text-3xl font-bold text-cyber-green mb-2">
            {concertArtists.filter(c => c.vibe_rating).length > 0 
              ? (concertArtists.reduce((sum, c) => sum + (c.vibe_rating || 0), 0) / concertArtists.filter(c => c.vibe_rating).length).toFixed(1)
              : 'N/A'}
          </div>
          <div className="text-gray-400">Avg Vibe Rating</div>
        </div>
      </div>
    </div>
  );
};

export default ConcertCompassTab;
