import React, { useState } from 'react';
import { Activity, BarChart3, Compass, Users, Loader2, AlertCircle, Lightbulb } from 'lucide-react';
import { useData } from './hooks/useData';
import PulseTab from './components/PulseTab';
import LeaderboardTab from './components/LeaderboardTab';
import ConcertCompassTab from './components/ConcertCompassTab';
import ArtistStatsTab from './components/ArtistStatsTab';
import AdvancedInsightsTab from './components/AdvancedInsightsTab';

const LoadingScreen = () => (
  <div className="min-h-screen bg-dark-bg flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin mb-4">
        <Loader2 className="w-12 h-12 text-cyber-blue mx-auto" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Loading TempoTraceAI</h2>
      <p className="text-gray-400">Analyzing your musical journey...</p>
    </div>
  </div>
);

const ErrorScreen = ({ error }) => (
  <div className="min-h-screen bg-dark-bg flex items-center justify-center">
    <div className="text-center max-w-md">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Unable to Load Data</h2>
      <p className="text-gray-400 mb-4">{error}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="cyber-button"
      >
        Try Again
      </button>
    </div>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('pulse');
  const { lifetimeStats, annualRecaps, artistSummary, concertData, loading, liveDataLoaded, error } = useData();

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} />;
  }

  const tabs = [
    { id: 'pulse', label: 'The Pulse', icon: Activity },
    { id: 'leaderboard', label: 'Leaderboard', icon: BarChart3 },
    { id: 'stats', label: 'Artists', icon: Users },
    { id: 'compass', label: 'Concert Compass', icon: Compass },
    { id: 'advanced', label: 'Insights', icon: Lightbulb }
  ];

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-card-bg/80 to-border-glow/80 backdrop-blur-lg border-b border-cyber-blue/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold font-cyber">
                  <span className="bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
                    TempoTraceAI
                  </span>
                </h1>
              </div>
              {/* Live data status indicator */}
              <div className="flex items-center gap-1.5 text-xs">
                {liveDataLoaded ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-cyber-blue animate-pulse inline-block"></span>
                    <span className="text-cyber-blue hidden sm:inline">Live</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-gray-500 inline-block"></span>
                    <span className="text-gray-500 hidden sm:inline">Syncing…</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="flex space-x-1 sm:space-x-2">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`cyber-tab flex items-center gap-0 sm:gap-2 ${
                      activeTab === tab.id ? 'active' : ''
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'pulse' && (
          <PulseTab
            data={lifetimeStats}
            artistSummary={artistSummary}
            concertData={concertData}
            recapData={annualRecaps}
          />
        )}
        
        {activeTab === 'leaderboard' && (
          <LeaderboardTab data={annualRecaps} />
        )}

        {activeTab === 'advanced' && (
          <AdvancedInsightsTab 
            data={lifetimeStats} 
            artistSummary={artistSummary} 
            concertData={concertData} 
            recapData={annualRecaps}
          />
        )}
        
        {activeTab === 'compass' && (
          <ConcertCompassTab 
            streamingData={null}
            concertData={concertData}
            artistSummary={artistSummary}
          />
        )}
        
        {activeTab === 'stats' && (
          <ArtistStatsTab data={artistSummary} />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-gradient-to-r from-card-bg/40 to-border-glow/40 backdrop-blur-sm border-t border-cyber-blue/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              Powered by Zach's Spotify + Apple Music Streaming History Data • Built with AI
            </p>
            <div className="mt-2 flex justify-center space-x-6">
              <div className="text-xs text-gray-500">
                {(lifetimeStats?.content_stats?.total_plays || 0).toLocaleString()} streams analyzed
              </div>
              <div className="text-xs text-gray-500">
                {(lifetimeStats?.content_stats?.unique_artists || 0).toLocaleString()} artists explored
              </div>
              <div className="text-xs text-gray-500">
                {Math.round(lifetimeStats?.time_stats?.total_hours || 0).toLocaleString()} hours of music
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
