import type { Aircraft } from '../opensky/types';

export interface HistoryPoint {
  longitude: number;
  latitude: number;
  altitude: number | null;
  timestamp: number;
}

export interface TrackedAircraft extends Aircraft {
  status: 'live' | 'stale' | 'lost';
  firstSeen: number;
  lastSeen: number;
  history: HistoryPoint[];
  projectedLat?: number;
  projectedLon?: number;
  smoothHeading?: number;
  displayAltitude?: number;
  isEmergency?: boolean;
}

export interface FetchHealth {
  status: 'live' | 'degraded' | 'rate_limited' | 'offline';
  lastSuccessTime: number | null;
  creditsRemaining: number | null;
  errorCount: number;
  nextRefreshTime: number | null;
  latencyMs: number | null;
  isCached: boolean;
  retryCountdown: number;
}

export interface AirspaceFilter {
  minAltitude: number; // in meters (0 to 15000)
  maxAltitude: number;
  minSpeed: number; // in km/h
  airborneOnly: boolean;
  showGroundAircraft: boolean;
  searchQuery: string;
}

export interface ChaosSettings {
  forceRateLimit: boolean;
  forcePacketLoss: boolean;
  forceEmergencySquawk: boolean;
  forceGpsJitter: boolean;
  forceOffline: boolean;
}

export interface AtcEvent {
  id: string;
  timestamp: number;
  type: 'emergency' | 'climb' | 'descent' | 'sector_enter' | 'system';
  callsign: string;
  message: string;
}

export interface ReplaySnapshot {
  timestamp: number;
  aircraft: Record<string, TrackedAircraft>;
}

export type ViewMode = '2d' | '3d' | 'globe';
export type ThemeMode = 'night' | 'day';
