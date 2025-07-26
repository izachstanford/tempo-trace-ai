import React from 'react';
import { Activity } from 'lucide-react';

// Import real data charts
import GlobalMusicMap from './charts/GlobalMusicMap';
import ConcertStreamingHeatmap from './charts/ConcertStreamingHeatmap';
import ArtistLoyaltyConstellation from './charts/ArtistLoyaltyConstellation';
import PlatformEcosystemWeb from './charts/PlatformEcosystemWeb';
import DiscoveryNostalgiaFlow from './charts/DiscoveryNostalgiaFlow';
import EmotionalListeningLandscape from './charts/EmotionalListeningLandscape';
import ArtistRankingSankey from './charts/ArtistRankingSankey';

const ChartCard = ({ title, children, className = "" }) => (
  <div className={`cyber-card p-6 w-full h-auto flex flex-col justify-start items-stretch my-8 ${className}`}> 
    <h3 className="text-lg font-bold text-cyber-blue mb-4 flex items-center gap-2">
      <Activity className="w-5 h-5 text-cyber-blue" />
      {title}
    </h3>
    <div className="flex-1 w-full h-full">{children}</div>
  </div>
);

const AdvancedInsightsTab = ({ data, artistSummary, concertData, recapData }) => {
  if (!data) {
    return (
      <div className="text-center py-12">
        <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Loading advanced insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold font-cyber mb-2">
          <span className="bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
            Advanced Insights
          </span>
        </h1>
        <p className="text-gray-400">Deep analytics powered by your real listening data</p>
      </div>
      
      <div className="flex flex-col gap-12">
        <ChartCard title="Artist Rankings Evolution">
          <ArtistRankingSankey data={data} recapData={recapData} artistSummary={artistSummary} />
        </ChartCard>
        
        <ChartCard title="Global Music Map">
          <GlobalMusicMap data={data} />
        </ChartCard>
        
        <ChartCard title="Concert Streaming Correlation">
          <ConcertStreamingHeatmap data={data} concertData={concertData} artistSummary={artistSummary} />
        </ChartCard>
        
        <ChartCard title="Artist Loyalty Constellation">
          <ArtistLoyaltyConstellation data={data} artistSummary={artistSummary} concertData={concertData} />
        </ChartCard>
        
        <ChartCard title="Platform Ecosystem Network">
          <PlatformEcosystemWeb data={data} />
        </ChartCard>
        
        <ChartCard title="Discovery vs Nostalgia Flow">
          <DiscoveryNostalgiaFlow data={data} artistSummary={artistSummary} />
        </ChartCard>
        
        <ChartCard title="Emotional Listening Landscape">
          <EmotionalListeningLandscape data={data} artistSummary={artistSummary} />
        </ChartCard>
      </div>
    </div>
  );
};

export default AdvancedInsightsTab;
