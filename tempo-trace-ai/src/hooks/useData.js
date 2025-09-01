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
        
        // Load lifetime streaming stats (for The Pulse tab)
        let lifetimeResponse = await fetch('./data/lifetime_streaming_stats.json');
        if (!lifetimeResponse.ok) {
          throw new Error('Failed to load lifetime streaming stats');
        }
        const lifetimeJson = await lifetimeResponse.json();
        setLifetimeStats(lifetimeJson);
        
        // Load annual recaps (for Leaderboard tab)
        let recapsResponse = await fetch('./data/annual_recaps.json');
        if (!recapsResponse.ok) {
          throw new Error('Failed to load annual recaps');
        }
        const recapsJson = await recapsResponse.json();
        setAnnualRecaps(recapsJson);
        
        // Load artist summary (for Concert Compass tab)
        let artistResponse = await fetch('./data/artist_summary.json');
        if (!artistResponse.ok) {
          throw new Error('Failed to load artist summary');
        }
        const artistJson = await artistResponse.json();
        setArtistSummary(artistJson);
        
        // Load concert data (for Concert Compass tab)
        let concertResponse = await fetch('./data/concerts.json');
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
