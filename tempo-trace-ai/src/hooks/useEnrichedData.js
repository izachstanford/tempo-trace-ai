import { useEffect, useState } from 'react';

const API_BASE = 'https://aiwithzach.com/api';
const STATIC_PATH = './data/spotify_enriched_data.json';

let enrichedCache = null;
let inFlightRequest = null;

const fetchEnrichedData = async () => {
  try {
    const res = await fetch(`${API_BASE}/tempo-api-enriched-data`);
    if (res.ok) return await res.json();
    throw new Error(`API returned ${res.status}`);
  } catch {
    const res = await fetch(STATIC_PATH);
    if (!res.ok) throw new Error(`Static fallback returned ${res.status}`);
    return await res.json();
  }
};

export const useEnrichedData = () => {
  const [data, setData] = useState(enrichedCache);
  const [loading, setLoading] = useState(!enrichedCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (enrichedCache) {
        setData(enrichedCache);
        setLoading(false);
        return;
      }

      try {
        if (!inFlightRequest) {
          inFlightRequest = fetchEnrichedData();
        }
        const result = await inFlightRequest;
        enrichedCache = result;
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load enriched data');
        }
      } finally {
        inFlightRequest = null;
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { enrichedData: data, loading, error };
};

