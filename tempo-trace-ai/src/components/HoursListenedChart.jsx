import React from 'react';
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
import { Line } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';

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

// Accepts either:
//   lifetimeStats  — preferred; uses temporal_patterns.yearly_breakdown (live, always current)
//   recapData      — legacy fallback; uses annualRecaps year_stats.total_hours (static)
const HoursListenedChart = ({ lifetimeStats, recapData }) => {
  const currentYear = new Date().getFullYear();

  // Build { year: hours } from lifetimeStats if available, else fall back to recapData
  const yearHours = (() => {
    const yd = lifetimeStats?.temporal_patterns?.yearly_breakdown;
    if (yd && Object.keys(yd).length > 0) {
      const result = {};
      Object.entries(yd).forEach(([yr, v]) => {
        result[yr] = Math.round((v.ms_played || 0) / 3600000);
      });
      return result;
    }
    if (recapData) {
      const result = {};
      Object.entries(recapData).forEach(([yr, v]) => {
        result[yr] = Math.round(v?.year_stats?.total_hours || 0);
      });
      return result;
    }
    return {};
  })();

  const years = Object.keys(yearHours).sort();

  if (years.length === 0) return null;

  const hoursData = years.map(y => yearHours[y]);

  // Projected hours for current year: (hours so far / days elapsed) * 365
  const currentYearHours = yearHours[currentYear];
  let projectedHours = null;
  if (currentYearHours != null) {
    const jan1 = new Date(currentYear, 0, 1);
    const today = new Date();
    const daysElapsed = Math.max(1, (today - jan1) / (1000 * 60 * 60 * 24));
    projectedHours = Math.round((currentYearHours / daysElapsed) * 365);
  }

  const lastFullYearIdx = years.findIndex(y => parseInt(y) === currentYear) - 1;
  const projectedWithBridge = years.map((year, idx) => {
    if (parseInt(year) === currentYear) return projectedHours;
    if (idx === lastFullYearIdx) return hoursData[idx];
    return null;
  });

  const chartData = {
    labels: years,
    datasets: [
      {
        label: 'Hours Listened',
        data: hoursData,
        borderColor: '#00f5ff',
        backgroundColor: 'rgba(0, 245, 255, 0.1)',
        fill: true,
        pointStyle: 'circle',
        pointBackgroundColor: '#00f5ff',
        pointBorderColor: '#00f5ff',
        pointRadius: 4,
        tension: 0.3,
        order: 1
      },
      ...(projectedHours !== null ? [{
        label: `${currentYear} Projected`,
        data: projectedWithBridge,
        borderColor: '#a855f7',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        pointStyle: 'circle',
        pointBackgroundColor: '#a855f7',
        pointBorderColor: '#a855f7',
        pointRadius: years.map((y, i) => (parseInt(y) === currentYear || i === lastFullYearIdx) ? 5 : 0),
        tension: 0.3,
        fill: false,
        order: 2
      }] : [])
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: projectedHours !== null,
        labels: { color: '#ffffff', usePointStyle: true, pointStyleWidth: 16 }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        titleColor: '#00f5ff',
        bodyColor: '#ffffff',
        borderColor: '#00f5ff',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            if (context.parsed.y === null) return null;
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} hours`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#ffffff' }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#ffffff' },
        title: { display: true, text: 'Hours Listened', color: '#ffffff' }
      }
    }
  };

  return (
    <div className="cyber-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-cyber-blue" />
          <h3 className="text-lg font-bold text-cyber-blue">Hours Listened by Year</h3>
        </div>
        {projectedHours !== null && (
          <span className="text-xs text-gray-400">
            Projected {currentYear}: <span className="text-purple-400 font-bold">{projectedHours.toLocaleString()}h</span>
          </span>
        )}
      </div>
      <div className="chart-container" style={{ height: '300px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default HoursListenedChart;
