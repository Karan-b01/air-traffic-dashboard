// src/hooks/usePolling.ts
import { useEffect, useRef, useCallback } from 'react';
import { useAircraftStore } from '../lib/state/useAircraftStore';
import { normalizeStateVector } from '../app/api/opensky/normalizer';
import type { RawStateVector } from '../lib/opensky/types';
// Default bounding box (Example: A large area over India)
// You can adjust these later when we build the map view
const DEFAULT_BBOX = {
  lamin: 8.0,
  lomin: 68.0,
  lamax: 37.0,
  lomax: 97.0,
};

export function usePolling(intervalMs: number = 10000) {
  const { mergeUpdate, setHealth } = useAircraftStore();
  
  // Use refs so we don't trigger re-renders just by tracking request status
  const isFetching = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    // 1. Prevent overlapping requests
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      const { lamin, lomin, lamax, lomax } = DEFAULT_BBOX;
      const url = `/api/opensky?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
      
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        // Handle Rate limits (429) or Server Errors (500)
        setHealth({ 
          status: response.status === 429 ? 'rate_limited' : 'degraded',
          errorCount: useAircraftStore.getState().health.errorCount + 1
        });
        isFetching.current = false;
        return;
      }

      // OpenSky returns null for 'states' if no aircraft are in the bounding box
      const rawStates: RawStateVector[] = result.data?.states || [];
      
      // 2. Clean the data using our normalizer
      const cleanedAircraft = rawStates.map(normalizeStateVector);

      // 3. Send it to the Zustand store to be merged
      mergeUpdate(cleanedAircraft, result.fetchedAt, result.credits);

    } catch (error) {
      console.error("Failed to fetch aircraft:", error);
      setHealth({ status: 'degraded', errorCount: useAircraftStore.getState().health.errorCount + 1 });
    } finally {
      isFetching.current = false;
    }
  }, [mergeUpdate, setHealth]);

  useEffect(() => {
    // Do an immediate fetch on mount
    fetchData();

    // Setup the smart polling interval
    const tick = () => {
      // 4. Page Visibility API: Only fetch if the user is actually looking at the tab
      if (document.visibilityState === 'visible') {
        fetchData();
      }
      timeoutRef.current = setTimeout(tick, intervalMs);
    };

    timeoutRef.current = setTimeout(tick, intervalMs);

    // 5. Resume immediately if the user comes back to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, intervalMs]);
}