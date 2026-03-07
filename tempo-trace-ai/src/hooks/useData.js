import { useState, useEffect } from 'react';

const API_BASE = 'https://aiwithzach.com/api';

// Static snapshots refreshed weekly by GitHub Actions (.github/workflows/refresh-static-snapshots.yml).
// Only lifetimeStats fetches live data — for real-time stats (total plays, most recent track,
// yearly_breakdown for the hours chart). All other datasets are static-only to avoid
// intermittent Supabase view failures that previously blanked the UI.
const STATIC_FILES = {
  lifetimeStats: './data/lifetime_streaming_stats.json',
  annualRecaps:  './data/annual_recaps.json',
  artistSummary: './data/artist_summary.json',
  concertData:   './data/concerts.json',
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
        // ── Phase 1: load all static snapshots immediately ───────────────────
        const [staticLifetime, staticRecaps, staticArtists, staticConcerts] =
          await Promise.all([
            fetchStatic(STATIC_FILES.lifetimeStats),
            fetchStatic(STATIC_FILES.annualRecaps),
            fetchStatic(STATIC_FILES.artistSummary),
            fetchStatic(STATIC_FILES.concertData),
          ]);

        if (cancelled) return;
        setLifetimeStats(staticLifetime);
        setAnnualRecaps(staticRecaps);
        setArtistSummary(staticArtists);
        setConcertData(staticConcerts);
        setLoading(false);

        // ── Phase 2: live fetch for lifetimeStats only ────────────────────────
        // Provides: real-time total plays, most recent track, current-year
        // hours (temporal_patterns.yearly_breakdown) for the trend chart.
        try {
          const liveData = await fetchApi('/tempo-api-lifetime-stats');
          if (!cancelled) {
            setLifetimeStats(prev => {
              // Always preserve top_lists from the static weekly snapshot.
              // Live data updates real-time stats (total plays, most recent track,
              // yearly_breakdown for the hours chart) but rankings and the
              // top-artist/track/album tables stay stable and image-rich.
              const staticTopLists = prev?.top_lists;
              return staticTopLists
                ? { ...liveData, top_lists: staticTopLists }
                : liveData;
            });
            setLiveDataLoaded(true);
          }
        } catch (err) {
          if (!cancelled) {
            console.warn('Live lifetimeStats fetch failed, using static data:', err?.message || err);
          }
        }

      } catch (err) {
        if (!cancelled) {
          console.error('Error loading static data:', err);
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
