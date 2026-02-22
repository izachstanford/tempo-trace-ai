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
        
        // Helper function to try API first, fallback to static file
        const fetchWithFallback = async (apiEndpoint, staticFile) => {
          try {
            const apiResponse = await fetch(`${API_BASE}${apiEndpoint}`);
            if (apiResponse.ok) {
              return await apiResponse.json();
            }
          } catch (error) {
            console.warn(`API unavailable (${apiEndpoint}), using static fallback`);
          }

          const staticResponse = await fetch(staticFile);
          if (!staticResponse.ok) {
            throw new Error(`Failed to load ${staticFile}`);
          }
          return await staticResponse.json();
        };
        
        // Load all data with automatic fallback
        const [lifetimeJson, recapsJson, artistJson, concertJson] = await Promise.all([
          fetchWithFallback('/tempo-api-lifetime-stats', './data/lifetime_streaming_stats.json'),
          fetchWithFallback('/tempo-api-annual-recaps', './data/annual_recaps.json'),
          fetchWithFallback('/tempo-api-artist-summary', './data/artist_summary.json'),
          fetchWithFallback('/tempo-api-concerts', './data/concerts.json')
        ]);
        
        setLifetimeStats(lifetimeJson);
        setAnnualRecaps(recapsJson);
        setArtistSummary(artistJson);
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
