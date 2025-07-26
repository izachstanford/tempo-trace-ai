import React, { useMemo, useState, useEffect } from 'react';
import * as d3 from 'd3';

const PlatformEcosystemWeb = ({ data }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);

  const processedData = useMemo(() => {
    if (!data?.platform_stats?.distribution || !data?.provider_stats?.distribution) {
      return { networkData: { nodes: [], links: [] }, stats: null };
    }

    const platforms = data.platform_stats.distribution;
    const providers = data.provider_stats.distribution;
    const totalPlays = data.content_stats.total_plays;

    // Create nodes for platforms and providers
    const nodeData = [];
    const linkData = [];
    
    // Central hub node (you)
    nodeData.push({
      id: 'user',
      type: 'user',
      name: 'Your Music Hub',
      plays: totalPlays,
      size: 30,
      color: '#ffffff',
      x: 300,
      y: 200,
      fixed: true
    });

    // Platform nodes
    Object.entries(platforms).forEach(([platform, plays], index) => {
      const angle = (index / Object.keys(platforms).length) * 2 * Math.PI;
      const radius = 120;
      
      nodeData.push({
        id: `platform-${platform}`,
        type: 'platform',
        name: platform,
        plays,
        size: 8 + (plays / Math.max(...Object.values(platforms))) * 15,
        color: d3.schemeCategory10[index % 10],
        x: 300 + Math.cos(angle) * radius,
        y: 200 + Math.sin(angle) * radius,
        percentage: (plays / totalPlays) * 100
      });

      // Link platform to user
      linkData.push({
        source: 'user',
        target: `platform-${platform}`,
        strength: plays / Math.max(...Object.values(platforms)),
        plays,
        type: 'platform-connection'
      });
    });

    // Provider nodes (further out)
    Object.entries(providers).forEach(([provider, plays], index) => {
      const angle = (index / Object.keys(providers).length) * 2 * Math.PI + Math.PI/4;
      const radius = 180;
      
      nodeData.push({
        id: `provider-${provider}`,
        type: 'provider',
        name: provider,
        plays,
        size: 15 + (plays / Math.max(...Object.values(providers))) * 20,
        color: provider === 'Spotify' ? '#1db954' : provider === 'Apple Music' ? '#fa233b' : '#8b5cf6',
        x: 300 + Math.cos(angle) * radius,
        y: 200 + Math.sin(angle) * radius,
        percentage: (plays / totalPlays) * 100
      });

      // Link provider to user
      linkData.push({
        source: 'user',
        target: `provider-${provider}`,
        strength: plays / Math.max(...Object.values(providers)),
        plays,
        type: 'provider-connection'
      });

      // Link providers to compatible platforms
      Object.entries(platforms).forEach(([platform, platformPlays]) => {
        // Simulate platform-provider relationships based on typical usage patterns
        let connectionStrength = 0;
        
        if (provider === 'Spotify') {
          if (['iOS', 'macOS', 'Windows', 'Web Player'].includes(platform)) {
            connectionStrength = 0.7;
          } else if (['Watch', 'Garmin'].includes(platform)) {
            connectionStrength = 0.3;
          }
        } else if (provider === 'Apple Music') {
          if (['iOS', 'macOS', 'Watch'].includes(platform)) {
            connectionStrength = 0.9;
          } else if (['Windows', 'Web Player'].includes(platform)) {
            connectionStrength = 0.2;
          }
        }

        if (connectionStrength > 0.1) {
          linkData.push({
            source: `platform-${platform}`,
            target: `provider-${provider}`,
            strength: connectionStrength * 0.5,
            plays: Math.round(platformPlays * connectionStrength),
            type: 'cross-connection'
          });
        }
      });
    });


    const stats = {
      totalPlatforms: Object.keys(platforms).length,
      totalProviders: Object.keys(providers).length,
      primaryPlatform: Object.entries(platforms).sort(([,a], [,b]) => b - a)[0],
      primaryProvider: Object.entries(providers).sort(([,a], [,b]) => b - a)[0]
    };

    return { networkData: { nodes: nodeData, links: linkData }, stats };
  }, [data]);

  // Initialize force simulation
  useEffect(() => {
    if (!processedData.networkData.nodes.length) return;

    const sim = d3.forceSimulation(processedData.networkData.nodes)
      .force('link', d3.forceLink(processedData.networkData.links)
        .id(d => d.id)
        .strength(d => d.strength * 0.5))
      .force('charge', d3.forceManyBody()
        .strength(d => d.type === 'user' ? -500 : -100))
      .force('center', d3.forceCenter(300, 200))
      .force('collision', d3.forceCollide().radius(d => d.size + 5))
      .alpha(0.3)
      .alphaDecay(0.02);

    sim.on('tick', () => {
      setNodes([...processedData.networkData.nodes]);
      setLinks([...processedData.networkData.links]);
    });

    setSimulation(sim);

    return () => {
      sim.stop();
    };
  }, [processedData.networkData]);

  const handleNodeClick = (node) => {
    if (selectedNode?.id === node.id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  };

  const getNodeOpacity = (node) => {
    if (!selectedNode) return 1;
    if (selectedNode.id === node.id) return 1;
    
    // Show connected nodes
    const connectedNodes = links
      .filter(link => link.source.id === selectedNode.id || link.target.id === selectedNode.id)
      .map(link => link.source.id === selectedNode.id ? link.target.id : link.source.id);
    
    return connectedNodes.includes(node.id) ? 0.8 : 0.2;
  };

  const getLinkOpacity = (link) => {
    if (!selectedNode) return link.type === 'cross-connection' ? 0.3 : 0.6;
    return (link.source.id === selectedNode.id || link.target.id === selectedNode.id) ? 1 : 0.1;
  };

  if (!processedData.networkData.nodes.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>Loading platform ecosystem...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <svg width="100%" height="100%" viewBox="0 0 600 400">
        <defs>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="linkGlow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <radialGradient id="userGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
            <stop offset="70%" stopColor="#00f5ff" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3"/>
          </radialGradient>
        </defs>

        {/* Background pattern */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff" strokeWidth="0.3" opacity="0.1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Links */}
        {links.map((link, index) => {
          const opacity = getLinkOpacity(link);
          let strokeColor = '#666666';
          let strokeWidth = 1;
          
          if (link.type === 'platform-connection') {
            strokeColor = '#00f5ff';
            strokeWidth = 2 + link.strength * 3;
          } else if (link.type === 'provider-connection') {
            strokeColor = '#ff0080';
            strokeWidth = 2 + link.strength * 4;
          } else if (link.type === 'cross-connection') {
            strokeColor = '#8b5cf6';
            strokeWidth = 1 + link.strength * 2;
          }

          return (
            <line
              key={`${link.source.id}-${link.target.id}-${index}`}
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              opacity={opacity}
              filter={opacity > 0.5 ? "url(#linkGlow)" : "none"}
              className="transition-opacity duration-300"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const opacity = getNodeOpacity(node);
          const isSelected = selectedNode?.id === node.id;
          
          return (
            <g key={node.id}>
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size}
                fill={node.type === 'user' ? 'url(#userGradient)' : node.color}
                stroke="#ffffff"
                strokeWidth={isSelected ? 3 : 1}
                opacity={opacity}
                filter={node.type === 'user' || opacity > 0.7 ? "url(#nodeGlow)" : "none"}
                className="cursor-pointer transition-all duration-300 hover:opacity-100"
                onClick={() => handleNodeClick(node)}
              />

              {/* Node label */}
              <text
                x={node.x}
                y={node.y + node.size + 15}
                fill="#ffffff"
                fontSize={node.type === 'user' ? '12' : '10'}
                fontWeight={node.type === 'user' ? 'bold' : 'normal'}
                textAnchor="middle"
                className="pointer-events-none"
                opacity={opacity}
              >
                {node.name}
              </text>

              {/* Play count for non-user nodes */}
              {node.type !== 'user' && node.plays && (
                <text
                  x={node.x}
                  y={node.y + node.size + 28}
                  fill={node.color}
                  fontSize="8"
                  textAnchor="middle"
                  className="pointer-events-none"
                  opacity={opacity * 0.8}
                >
                  {node.plays > 999 ? `${Math.round(node.plays/1000)}k` : node.plays}
                </text>
              )}

              {/* Type indicator */}
              {node.type !== 'user' && (
                <circle
                  cx={node.x + node.size - 3}
                  cy={node.y - node.size + 3}
                  r="3"
                  fill={
                    node.type === 'platform' ? '#00f5ff' :
                    node.type === 'provider' ? '#ff0080' : '#fbbf24'
                  }
                  opacity={opacity}
                  className="pointer-events-none"
                />
              )}
            </g>
          );
        })}

        {/* Selected node details */}
        {selectedNode && selectedNode.type !== 'user' && (
          <g transform="translate(420, 50)">
            <rect width="160" height="120" fill="rgba(0, 0, 0, 0.9)" rx="8" stroke={selectedNode.color} strokeWidth="2" />
            <text x="10" y="20" fill={selectedNode.color} fontSize="14" fontWeight="bold">
              {selectedNode.name}
            </text>
            <text x="10" y="40" fill="#ffffff" fontSize="12">
              Type: {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
            </text>
            {selectedNode.plays && (
              <>
                <text x="10" y="55" fill="#ffffff" fontSize="10">
                  Plays: {selectedNode.plays.toLocaleString()}
                </text>
                <text x="10" y="70" fill="#ffffff" fontSize="10">
                  Share: {selectedNode.percentage?.toFixed(1)}%
                </text>
              </>
            )}
            
            {/* Connection count */}
            <text x="10" y="90" fill="#ffffff" fontSize="9">
              Connections: {links.filter(l => 
                l.source.id === selectedNode.id || l.target.id === selectedNode.id
              ).length}
            </text>
            
            <text x="10" y="105" fill="#gray" fontSize="8">
              Click node to deselect
            </text>
          </g>
        )}

        {/* Legend */}
        <g transform="translate(20, 20)">
          <rect width="180" height="140" fill="rgba(0, 0, 0, 0.8)" rx="8" />
          <text x="10" y="20" fill="#ffffff" fontSize="12" fontWeight="bold">
            Platform Ecosystem
          </text>
          
          {/* Node types */}
          <circle cx="20" cy="35" r="8" fill="url(#userGradient)" />
          <text x="35" y="40" fill="#ffffff" fontSize="9">You (Central Hub)</text>
          
          <circle cx="20" cy="50" r="6" fill="#00f5ff" />
          <circle cx="23" cy="47" r="2" fill="#00f5ff" />
          <text x="35" y="54" fill="#ffffff" fontSize="9">Platforms</text>
          
          <circle cx="20" cy="65" r="8" fill="#ff0080" />
          <circle cx="23" cy="62" r="2" fill="#ff0080" />
          <text x="35" y="69" fill="#ffffff" fontSize="9">Music Services</text>
          

          {/* Connection types */}
          <text x="10" y="105" fill="#ffffff" fontSize="10" fontWeight="semibold">
            Connections
          </text>
          <line x1="15" y1="115" x2="30" y2="115" stroke="#00f5ff" strokeWidth="3" />
          <text x="35" y="119" fill="#ffffff" fontSize="8">Platform Usage</text>
          
          <line x1="15" y1="125" x2="30" y2="125" stroke="#ff0080" strokeWidth="3" />
          <text x="35" y="129" fill="#ffffff" fontSize="8">Service Usage</text>
        </g>

        {/* Stats panel */}
        <g transform="translate(420, 200)">
          <rect width="160" height="100" fill="rgba(0, 0, 0, 0.8)" rx="8" />
          <text x="10" y="20" fill="#ffffff" fontSize="12" fontWeight="bold">
            Ecosystem Stats
          </text>
          
          {processedData.stats && (
            <g>
              <text x="10" y="40" fill="#00f5ff" fontSize="10">
                Primary Platform:
              </text>
              <text x="10" y="54" fill="#ffffff" fontSize="10">
                {processedData.stats.primaryPlatform[0]}
              </text>
              
              <text x="10" y="70" fill="#ff0080" fontSize="10">
                Primary Service:
              </text>
              <text x="10" y="84" fill="#ffffff" fontSize="10">
                {processedData.stats.primaryProvider[0]}
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-black/70 rounded-lg p-3 hidden md:block">
        <div className="text-cyber-blue text-xs font-semibold mb-2">Interaction</div>
        <div className="text-gray-400 text-xs">
          <div>Click nodes to explore connections</div>
          <div className="mt-1">Node size = usage volume</div>
          <div>Link thickness = connection strength</div>
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 bg-black/70 rounded-lg p-3 max-w-sm hidden md:block">
        <h4 className="text-cyber-blue text-xs font-semibold mb-2">Platform Network Analysis</h4>
        <p className="text-gray-400 text-xs">
          Interactive network showing your music listening ecosystem. Platforms and services
          are connected based on usage patterns. Click any node to highlight its connections.
        </p>
      </div>
    </div>
  );
};

export default PlatformEcosystemWeb;
