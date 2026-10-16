// src/hooks/usePolling.ts
import { useCallback, useEffect, useRef } from 'react';
import { useAircraftStore } from '../lib/state/useAircraftStore';
import { normalizeOpenSkyResponse } from '../lib/opensky/normalizer';
import type { RawStateVector } from '../lib/opensky/types';

export const INITIAL_BACKOFF_MS = 15000; // 15 seconds initial 429 backoff
export const MAX_BACKOFF_MS = 60000;     // 60 seconds maximum backoff

/**
 * Calculates exponential backoff with decorrelated/uniform jitter to prevent thundering herds.
 * If Retry-After header is provided by upstream, it respects the exact server duration
 * and applies a subtle positive jitter (+0% to +10%) to prevent simultaneous reconnects.
 * Otherwise, applies standard exponential doubling (15s -> 30s -> 60s) with ±15% uniform jitter.
 */
export function calculateBackoffWithJitter(
  currentBackoffMs: number,
  retryAfterHeader?: string | null,
  randomFactor: number = Math.random()
): number {
  if (retryAfterHeader) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const baseMs = parsed * 1000;
      const positiveJitterMs = Math.round(baseMs * 0.10 * randomFactor);
      return baseMs + positiveJitterMs;
    }
  }

  const baseMs = currentBackoffMs === 0 ? INITIAL_BACKOFF_MS : Math.min(currentBackoffMs * 2, MAX_BACKOFF_MS);
  // ±15% jitter: multiplier in range [0.85, 1.15]
  const jitterMultiplier = 0.85 + (randomFactor * 0.30);
  return Math.round(baseMs * jitterMultiplier);
}

export function usePolling(intervalMs: number = 10000) {
  const { mergeUpdate, setHealth, pruneInactiveAircraft } = useAircraftStore();
  const isFetching = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffDelayRef = useRef<number>(0);

  // Clear any existing countdown timer
  const stopCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Starts a 1-second interval to decrement retryCountdown in the UI
  const startCountdown = useCallback((durationSeconds: number) => {
    stopCountdown();
    let remaining = durationSeconds;
    setHealth({ retryCountdown: remaining });

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stopCountdown();
        setHealth({ retryCountdown: 0 });
      } else {
        setHealth({ retryCountdown: remaining });
      }
    }, 1000);
  }, [setHealth, stopCountdown]);

  const scheduleNext = useCallback((delayMs: number, fetchFn: () => Promise<void>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        await fetchFn();
      } else {
        // Tab is hidden; re-schedule check
        scheduleNext(intervalMs, fetchFn);
      }
    }, delayMs);
  }, [intervalMs]);

  const fetchData = useCallback(async () => {
    const store = useAircraftStore.getState();
    if (store.replay.isReplaying || store.chaos.forceOffline) {
      if (store.chaos.forceOffline) {
        setHealth({ status: 'offline', isCached: true, dataSource: 'cache' });
      }
      scheduleNext(intervalMs, fetchData);
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

      // Handle HTTP 429 Rate Limit with Real Exponential Backoff & Retry-After Header
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const nextBackoff = calculateBackoffWithJitter(backoffDelayRef.current, retryAfterHeader);
        backoffDelayRef.current = nextBackoff;

        // If response provided cached/fallback data in body, merge it so UI stays live
        try {
          const body = await response.json();
          if (body?.data?.states) {
            const valid = normalizeOpenSkyResponse(body.data.states);
            mergeUpdate(valid, body.fetchedAt || Date.now(), '0 (Rate Limited)', latencyMs, body.dataSource, body.isSimulated);
          }
        } catch {
          // Body parsing optional
        }

        const countdownSec = Math.ceil(nextBackoff / 1000);
        setHealth({
          status: 'rate_limited',
          errorCount: store.health.errorCount + 1,
          retryCountdown: countdownSec,
          currentBackoffMs: nextBackoff,
          nextRefreshTime: Date.now() + nextBackoff,
          latencyMs,
        });

        startCountdown(countdownSec);
        scheduleNext(nextBackoff, fetchData);
        return;
      }

      // Handle 5xx Upstream Outages with Backoff
      if (!response.ok) {
        const nextBackoff = backoffDelayRef.current === 0 ? 15000 : Math.min(backoffDelayRef.current * 1.5, MAX_BACKOFF_MS);
        backoffDelayRef.current = nextBackoff;

        setHealth({
          status: 'degraded',
          errorCount: store.health.errorCount + 1,
          currentBackoffMs: nextBackoff,
          latencyMs,
        });

        scheduleNext(nextBackoff, fetchData);
        return;
      }

      // Successful HTTP 200 OK Response
      const result = await response.json();
      const rawStates: RawStateVector[] = result.data?.states || [];

      // Discard planes with missing lat/lon so they never get placed at (0, 0)
      const validAircraft = normalizeOpenSkyResponse(rawStates);

      // Reset exponential backoff on success
      backoffDelayRef.current = 0;
      stopCountdown();

      mergeUpdate(
        validAircraft,
        result.fetchedAt || Date.now(),
        result.credits || 'Unknown',
        latencyMs,
        result.dataSource,
        result.isSimulated
      );

      setHealth({
        status: result.rateLimited ? 'rate_limited' : 'live',
        isCached: Boolean(result.isCached),
        isSimulated: Boolean(result.isSimulated),
        dataSource: result.dataSource || (result.isSimulated ? 'simulated' : 'live'),
        currentBackoffMs: 0,
        retryCountdown: 0,
      });

      scheduleNext(intervalMs, fetchData);
    } catch (error) {
      console.warn('ADS-B stream degraded:', error);
      const nextBackoff = backoffDelayRef.current === 0 ? 15000 : Math.min(backoffDelayRef.current * 1.5, MAX_BACKOFF_MS);
      backoffDelayRef.current = nextBackoff;

      setHealth({
        status: 'degraded',
        errorCount: useAircraftStore.getState().health.errorCount + 1,
        currentBackoffMs: nextBackoff,
        latencyMs: Math.round(performance.now() - startTime),
      });

      scheduleNext(nextBackoff, fetchData);
    } finally {
      isFetching.current = false;
    }
  }, [intervalMs, mergeUpdate, scheduleNext, setHealth, startCountdown, stopCountdown]);

  useEffect(() => {
    // Initial fetch on mount
    fetchData();

    // Periodic 5-second lifecycle pruner: guarantees stale (>20s), lost (>60s), and 5-min (>300s) removals occur constantly
    const lifecycleInterval = setInterval(() => {
      pruneInactiveAircraft();
    }, 5000);

    // Page Visibility API: resume immediately when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopCountdown();
      clearInterval(lifecycleInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, pruneInactiveAircraft, stopCountdown]);
}