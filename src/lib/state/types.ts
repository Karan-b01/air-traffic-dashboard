import type { Aircraft } from '../opensky/types';

export interface TrackedAircraft extends Aircraft {
  status: 'live' | 'stale' | 'lost';
  firstSeen: number;
  lastSeen: number;
  history: Array<{
    longitude: number;
    latitude: number;
    altitude: number | null;
    timestamp: number;
  }>;
}

export interface FetchHealth {
  status: 'live' | 'degraded' | 'rate_limited';
  lastSuccessTime: number | null;
  creditsRemaining: number | null;
  errorCount: number;
  nextRefreshTime: number | null;
}
