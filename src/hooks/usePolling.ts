// src/hooks/usePolling.ts
import { useCallback, useEffect, useRef } from 'react';
import { useAircraftStore } from '../lib/state/useAircraftStore';
import { normalizeStateVector } from '../lib/opensky/normalizer';
import type { RawStateVector } from '../lib/opensky/types';

export function usePolling(intervalMs: number = 10000) {
  const { mergeUpdate, setHealth } = useAircraftStore();
  const isFetching = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    const store = useAircraftStore.getState();
    if (store.replay.isReplaying || store.chaos.forceOffline) {
      if (store.chaos.forceOffline) {
        setHealth({ status: 'offline', isCached: true });
      }
      return;
    }

    if (isFetching.current) return;
    isFetching.current = true;

    const startTime = performance.now();

    try {
      const { bbox } = store.activeSector;
      const { forceRateLimit, forcePacketLoss } = store.chaos;

      let url = `/api/opensky?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
      if (forceRateLimit) url += '&chaosRateLimit=true';
      if (forcePacketLoss) url += '&chaosPacketLoss=true';

      const response = await fetch(url);
      const latencyMs = Math.round(performance.now() - startTime);

      if (response.status === 429) {
        setHealth({
          status: 'rate_limited',
          errorCount: store.health.errorCount + 1,
          retryCountdown: 10,
          latencyMs,
        });
        isFetching.current = false;
        return;
      }

      if (!response.ok) {
        setHealth({
          status: 'degraded',
          errorCount: store.health.errorCount + 1,
          latencyMs,
        });
        isFetching.current = false;
        return;
      }

      const result = await response.json();
      const rawStates: RawStateVector[] = result.data?.states || [];
      const cleanedAircraft = rawStates.map(normalizeStateVector);

      mergeUpdate(cleanedAircraft, result.fetchedAt || Date.now(), result.credits || 'Unknown', latencyMs);

      if (result.isCached) {
        setHealth({ isCached: true, status: result.rateLimited ? 'rate_limited' : 'live' });
      }
    } catch (error) {
      console.warn('ADS-B stream degraded:', error);
      setHealth({
        status: 'degraded',
        errorCount: useAircraftStore.getState().health.errorCount + 1,
        latencyMs: Math.round(performance.now() - startTime),
      });
    } finally {
      isFetching.current = false;
    }
  }, [mergeUpdate, setHealth]);

  useEffect(() => {
    fetchData();

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData();
      }
      timeoutRef.current = setTimeout(tick, intervalMs);
    };

    timeoutRef.current = setTimeout(tick, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, intervalMs]);
}