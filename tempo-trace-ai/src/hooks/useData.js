import { useState, useEffect } from 'react';

const API_BASE = 'https://aiwithzach.com/api';

const ENDPOINTS = {
  lifetimeStats:  { api: '/tempo-api-lifetime-stats',  static: './data/lifetime_streaming_stats.json' },
  annualRecaps:   { api: '/tempo-api-annual-recaps',   static: './data/annual_recaps.json' },
  artistSummary:  { api: '/tempo-api-artist-summary',  static: './data/artist_summary.json' },
  concertData:    { api: '/tempo-api-concerts',        static: './data/concerts.json' },
};

const fetchStatic = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
};

const fetchApi = async (endpoint) => {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API ${endpoint} returned ${res.status}`);
  return res.json();
};

export const useData = () => {
  const [lifetimeStats, setLifetimeStats] = useState(null);
  const [annualRecaps, setAnnualRecaps]   = useState(null);
  const [artistSummary, setArtistSummary] = useState(null);
  const [concertData, setConcertData]     = useState(null);
  const [loading, setLoading]             = useState(true);
  const [liveDataLoaded, setLiveDataLoaded] = useState(false);
  const [error, setError]                 = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // ── Phase 1: load static files immediately ───────────────────────
        const [staticLifetime, staticRecaps, staticArtists, staticConcerts] =
          await Promise.all([
            fetchStatic(ENDPOINTS.lifetimeStats.static),
            fetchStatic(ENDPOINTS.annualRecaps.static),
            fetchStatic(ENDPOINTS.artistSummary.static),
            fetchStatic(ENDPOINTS.concertData.static),
          ]);

        if (cancelled) return;
        setLifetimeStats(staticLifetime);
        setAnnualRecaps(staticRecaps);
        setArtistSummary(staticArtists);
        setConcertData(staticConcerts);
        setLoading(false); // show UI immediately with static data

        // ── Phase 2: fetch live API in background ─────────────────────────
        // Each endpoint updates state independently as it resolves
        const tryLive = async (key, setter) => {
          try {
            const data = await fetchApi(ENDPOINTS[key].api);
            if (!cancelled) setter(data);
          } catch {
            // Keep static data if API fails — no-op
          }
        };

        await Promise.all([
          tryLive('lifetimeStats',  setLifetimeStats),
          tryLive('annualRecaps',   setAnnualRecaps),
          tryLive('artistSummary',  setArtistSummary),
          tryLive('concertData',    setConcertData),
        ]);

        if (!cancelled) setLiveDataLoaded(true);

      } catch (err) {
        if (!cancelled) {
          console.error('Error loading data:', err);
          setError(err.message);
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return { lifetimeStats, annualRecaps, artistSummary, concertData, loading, liveDataLoaded, error };
};
