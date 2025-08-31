import { useState, useEffect } from 'react';

export const useData = () => {
  const [lifetimeData, setLifetimeData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [concertData, setConcertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load consolidated lifetime data (includes Spotify enrichment)
        let lifetimeResponse = await fetch('./data/lifetime_data.json');
        if (!lifetimeResponse.ok) {
          throw new Error('Failed to load lifetime data');
        }
        const lifetimeJson = await lifetimeResponse.json();
        setLifetimeData(lifetimeJson);
        
        // Load consolidated yearly data (includes Spotify enrichment)
        let yearlyResponse = await fetch('./data/yearly_data.json');
        if (!yearlyResponse.ok) {
          throw new Error('Failed to load yearly data');
        }
        const yearlyJson = await yearlyResponse.json();
        setYearlyData(yearlyJson);
        
        // Load consolidated concert data (includes artist summary)
        let concertResponse = await fetch('./data/concert_data.json');
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

  // Extract individual components for backward compatibility
  const lifetimeStats = lifetimeData;
  const annualRecaps = yearlyData;
  const artistSummary = concertData?.artists;
  const concertDataOnly = concertData?.concerts;

  return { 
    lifetimeStats, 
    annualRecaps, 
    artistSummary, 
    concertData: concertDataOnly,
    // New consolidated data
    lifetimeData,
    yearlyData,
    concertData: concertData,
    loading, 
    error 
  };
};
