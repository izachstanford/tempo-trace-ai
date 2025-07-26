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

const HoursListenedChart = ({ data }) => {
  const currentYear = new Date().getFullYear();
  const years = Object.keys(data)
    .filter(year => parseInt(year) < currentYear) // Exclude current year
    .sort();
  const hoursData = years.map(year => Math.round(data[year].year_stats.total_hours));

  const chartData = {
    labels: years,
    datasets: [{
      label: 'Hours Listened',
      data: hoursData,
      borderColor: '#00f5ff',
      backgroundColor: 'rgba(0, 245, 255, 0.1)',
      fill: true,
      pointStyle: 'circle',
      pointBackgroundColor: '#00f5ff',
      pointBorderColor: '#00f5ff',
      pointRadius: 4,
      tension: 0.3
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        titleColor: '#00f5ff',
        bodyColor: '#ffffff',
        borderColor: '#00f5ff',
        borderWidth: 1,
        callbacks: {
          label: (context) => `${context.parsed.y.toLocaleString()} hours`
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
        title: {
          display: true,
          text: 'Hours Listened',
          color: '#ffffff'
        }
      }
    }
  };

  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="w-5 h-5 text-cyber-blue" />
        <h3 className="text-lg font-bold text-cyber-blue">Hours Listened by Year</h3>
      </div>
      <div className="chart-container" style={{ height: '300px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default HoursListenedChart;
