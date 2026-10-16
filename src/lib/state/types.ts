import type { Aircraft } from '../opensky/types';
import type { AlertRule } from '../persistence/db';

export interface HistoryPoint {
  longitude: number;
  latitude: number;
  altitude: number | null;
  timestamp: number;
}

export type ContactStatus = 'live' | 'aging' | 'stale' | 'lost';

export interface TrackedAircraft extends Aircraft {
  status: ContactStatus;
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
  dataSource?: 'live' | 'cache' | 'simulated';
  isSimulated?: boolean;
  lastSuccessTime: number | null;
  creditsRemaining: number | null;
  errorCount: number;
  nextRefreshTime: number | null;
  latencyMs: number | null;
  isCached: boolean;
  retryCountdown: number;
  currentBackoffMs?: number;
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
  type: 'emergency' | 'climb' | 'descent' | 'sector_enter' | 'alert_rule' | 'system';
  callsign: string;
  message: string;
}

export interface ReplaySnapshot {
  timestamp: number;
  aircraft: Record<string, TrackedAircraft>;
}

export type ViewMode = '2d' | '3d' | 'globe';
export type ThemeMode = 'night' | 'day';
export type UnitSystem = 'aviation' | 'metric';
