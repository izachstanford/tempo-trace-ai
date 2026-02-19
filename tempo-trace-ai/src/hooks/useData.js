import { useState, useEffect } from 'react';

export const useData = () => {
  const [lifetimeStats, setLifetimeStats] = useState(null);
  const [annualRecaps, setAnnualRecaps] = useState(null);
  const [artistSummary, setArtistSummary] = useState(null);
  const [concertData, setConcertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // API base URL - use main website for live data, fallback to static files
        const API_BASE = 'https://aiwithzach.com/api';
        const useStaticFallback = false; // Set to true to use old static files
        
        // Load lifetime streaming stats (for The Pulse tab)
        let lifetimeResponse = await fetch(
          useStaticFallback 
            ? './data/lifetime_streaming_stats.json'
            : `${API_BASE}/tempo-api-lifetime-stats`
        );
        if (!lifetimeResponse.ok) {
          throw new Error('Failed to load lifetime streaming stats');
        }
        const lifetimeJson = await lifetimeResponse.json();
        setLifetimeStats(lifetimeJson);
        
        // Load annual recaps (for Leaderboard tab)
        let recapsResponse = await fetch(
          useStaticFallback
            ? './data/annual_recaps.json'
            : `${API_BASE}/tempo-api-annual-recaps`
        );
        if (!recapsResponse.ok) {
          throw new Error('Failed to load annual recaps');
        }
        const recapsJson = await recapsResponse.json();
        setAnnualRecaps(recapsJson);
        
        // Load artist summary (for Concert Compass tab)
        let artistResponse = await fetch(
          useStaticFallback
            ? './data/artist_summary.json'
            : `${API_BASE}/tempo-api-artist-summary`
        );
        if (!artistResponse.ok) {
          throw new Error('Failed to load artist summary');
        }
        const artistJson = await artistResponse.json();
        setArtistSummary(artistJson);
        
        // Load concert data (for Concert Compass tab)
        let concertResponse = await fetch(
          useStaticFallback
            ? './data/concerts.json'
            : `${API_BASE}/tempo-api-concerts`
        );
        if (!concertResponse.ok) {
          throw new Error('Failed to load concert data');
        }
        const concertJson = await concertResponse.json();
        setConcertData(concertJson);
        
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { lifetimeStats, annualRecaps, artistSummary, concertData, loading, error };
};
