// src/lib/state/useAircraftStore.ts
import { create } from 'zustand';
import type { Aircraft } from '../opensky/types';
import type {
  AirspaceFilter,
  AtcEvent,
  ChaosSettings,
  FetchHealth,
  ReplaySnapshot,
  ThemeMode,
  TrackedAircraft,
  ViewMode,
} from './types';
import { soundFx } from '../audio/AudioSynthesizer';


export interface SectorConfig {
  id: string;
  name: string;
  subtitle: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  bbox: { lamin: number; lomin: number; lamax: number; lomax: number };
}

export const SECTORS: SectorConfig[] = [
  {
    id: 'india-south',
    name: 'India Control',
    subtitle: 'SOUTHERN SECTOR (BLR / MAA / TRV)',
    center: [79.1325, 12.9692],
    zoom: 6.2,
    bbox: { lamin: 8.0, lomin: 73.0, lamax: 16.5, lomax: 83.5 },
  },
  {
    id: 'india-all',
    name: 'India Airspace',
    subtitle: 'NATIONAL FLIGHT INFORMATION REGION',
    center: [78.9629, 20.5937],
    zoom: 4.8,
    bbox: { lamin: 8.0, lomin: 68.0, lamax: 35.0, lomax: 94.0 },
  },
  {
    id: 'mumbai-fir',
    name: 'Mumbai FIR',
    subtitle: 'WESTERN MARITIME CORRIDOR',
    center: [72.8777, 19.0760],
    zoom: 6.6,
    bbox: { lamin: 15.0, lomin: 68.0, lamax: 23.0, lomax: 76.0 },
  },
  {
    id: 'delhi-fir',
    name: 'Delhi NCR FIR',
    subtitle: 'NORTHERN TRUNK HUB',
    center: [77.1025, 28.7041],
    zoom: 6.8,
    bbox: { lamin: 25.0, lomin: 74.0, lamax: 32.0, lomax: 80.0 },
  },
  {
    id: 'europe-london',
    name: 'London Terminal',
    subtitle: 'HEATHROW / GATWICK METRO',
    center: [-0.1278, 51.5074],
    zoom: 6.4,
    bbox: { lamin: 49.5, lomin: -4.0, lamax: 54.0, lomax: 2.5 },
  },
  {
    id: 'usa-jfk',
    name: 'New York Metro',
    subtitle: 'JFK / EWR / LGA CORRIDOR',
    center: [-73.7781, 40.6413],
    zoom: 6.5,
    bbox: { lamin: 39.0, lomin: -76.0, lamax: 42.5, lomax: -71.5 },
  },
];

interface ReplayState {
  isReplaying: boolean;
  snapshots: ReplaySnapshot[];
  currentIndex: number;
  speed: number;
  isPlaying: boolean;
}

interface AircraftState {
  aircraft: Record<string, TrackedAircraft>;
  selectedId: string | null;
  health: FetchHealth;
  viewMode: ViewMode;
  themeMode: ThemeMode;
  filters: AirspaceFilter;
  chaos: ChaosSettings;
  radarSweepEnabled: boolean;
  densityHeatmapEnabled: boolean;
  rangeRingsEnabled: boolean;
  altitudeCorridorOpen: boolean;
  soundEnabled: boolean;
  events: AtcEvent[];
  replay: ReplayState;
  activeSector: SectorConfig;
  chaseCameraId: string | null;
  hoveredId: string | null;

  // Actions
  mergeUpdate: (newData: Aircraft[], timestamp: number, credits: string, latencyMs?: number) => void;
  selectAircraft: (id: string | null) => void;
  setHoveredId: (id: string | null) => void;
  setChaseCamera: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setFilter: (updates: Partial<AirspaceFilter>) => void;
  resetFilter: () => void;
  setChaos: (updates: Partial<ChaosSettings>) => void;
  toggleRadarSweep: () => void;
  toggleDensityHeatmap: () => void;
  toggleRangeRings: () => void;
  toggleAltitudeCorridor: () => void;
  toggleSound: () => void;
  addEvent: (event: Omit<AtcEvent, 'id' | 'timestamp'>) => void;
  setHealth: (updates: Partial<FetchHealth>) => void;
  setSector: (sectorId: string) => void;

  // Replay actions
  startReplay: () => void;
  stopReplay: () => void;
  setReplayIndex: (index: number) => void;
  setReplaySpeed: (speed: number) => void;
  toggleReplayPlay: () => void;
  triggerMaydayAlert: () => void;
}

const DEFAULT_FILTERS: AirspaceFilter = {
  minAltitude: 0,
  maxAltitude: 15000,
  minSpeed: 0,
  airborneOnly: false,
  showGroundAircraft: false,
  searchQuery: '',
};

export const useAircraftStore = create<AircraftState>((set, get) => ({
  aircraft: {},
  selectedId: null,
  chaseCameraId: null,
  hoveredId: null,
  health: {
    status: 'live',
    lastSuccessTime: null,
    creditsRemaining: null,
    errorCount: 0,
    nextRefreshTime: null,
    latencyMs: null,
    isCached: false,
    retryCountdown: 0,
  },
  viewMode: '3d', // Default to 3D with altitude stems!
  themeMode: 'night',
  filters: DEFAULT_FILTERS,
  chaos: {
    forceRateLimit: false,
    forcePacketLoss: false,
    forceEmergencySquawk: false,
    forceGpsJitter: false,
    forceOffline: false,
  },
  radarSweepEnabled: true,
  densityHeatmapEnabled: false,
  rangeRingsEnabled: true,
  altitudeCorridorOpen: false,
  soundEnabled: typeof window !== 'undefined' ? localStorage.getItem('atc_audio_enabled') === 'true' : false,
  events: [
    {
      id: 'init-1',
      timestamp: Date.now() - 4000,
      type: 'system',
      callsign: 'RADAR-NET',
      message: 'Air traffic control radar link initialized.',
    },
  ],
  replay: {
    isReplaying: false,
    snapshots: [],
    currentIndex: 0,
    speed: 1,
    isPlaying: false,
  },
  activeSector: SECTORS[0],

  mergeUpdate: (newData, timestamp, credits, latencyMs) => set((state) => {
    // If replaying or chaos offline, ignore live stream
    if (state.replay.isReplaying || state.chaos.forceOffline) return {};

    const updatedAircraft = { ...state.aircraft };
    const newEvents: AtcEvent[] = [];
    const chaosEmergency = state.chaos.forceEmergencySquawk;
    const chaosJitter = state.chaos.forceGpsJitter;

    newData.forEach((plane, index) => {
      // Apply simulated chaos if enabled
      let lon = plane.longitude;
      let lat = plane.latitude;
      if (chaosJitter) {
        lon += (Math.random() - 0.5) * 0.08;
        lat += (Math.random() - 0.5) * 0.08;
      }

      // First aircraft becomes emergency if chaos squawk is on
      const isEmergency = chaosEmergency && index === 0
        ? true
        : plane.squawk === '7700' || plane.squawk === '7600' || plane.squawk === '7500';

      const existing = updatedAircraft[plane.icao24];
      const newPosition = {
        longitude: lon,
        latitude: lat,
        altitude: plane.baroAltitude,
        timestamp,
      };

      if (existing) {
        // Detect significant flight events for the event feed
        if (existing.baroAltitude != null && plane.baroAltitude != null) {
          const altDiff = plane.baroAltitude - existing.baroAltitude;
          if (altDiff > 600) {
            newEvents.push({
              id: `${plane.icao24}-climb-${timestamp}`,
              timestamp,
              type: 'climb',
              callsign: plane.callsign.trim() || plane.icao24.toUpperCase(),
              message: `Climbing to FL${Math.round((plane.baroAltitude * 3.28084) / 100)} (+${Math.round(plane.verticalRate || 0)}m/s)`,
            });
          } else if (altDiff < -600) {
            newEvents.push({
              id: `${plane.icao24}-desc-${timestamp}`,
              timestamp,
              type: 'descent',
              callsign: plane.callsign.trim() || plane.icao24.toUpperCase(),
              message: `Descending to FL${Math.round((plane.baroAltitude * 3.28084) / 100)}`,
            });
          }
        }

        const history = [...existing.history, newPosition].slice(-40);
        updatedAircraft[plane.icao24] = {
          ...existing,
          ...plane,
          longitude: lon,
          latitude: lat,
          status: 'live',
          lastSeen: timestamp,
          history,
          isEmergency,
        };
      } else {
        // New plane entering sector
        newEvents.push({
          id: `${plane.icao24}-enter-${timestamp}`,
          timestamp,
          type: 'sector_enter',
          callsign: plane.callsign.trim() || plane.icao24.toUpperCase(),
          message: `Contact acquired from ${plane.originCountry || 'airspace'}`,
        });

        updatedAircraft[plane.icao24] = {
          ...plane,
          longitude: lon,
          latitude: lat,
          status: 'live',
          firstSeen: timestamp,
          lastSeen: timestamp,
          history: [newPosition],
          isEmergency,
        };
      }
    });

    // Mark missing aircraft as stale if not seen in 25s, lost if > 60s
    const now = timestamp;
    for (const icao in updatedAircraft) {
      const plane = updatedAircraft[icao];
      const age = now - plane.lastSeen;
      if (age > 60000) {
        plane.status = 'lost';
      } else if (age > 20000) {
        plane.status = 'stale';
      }
    }

    // Save snapshot for Blackbox Replay mode (keep last 30 snapshots)
    const newSnapshot: ReplaySnapshot = {
      timestamp,
      aircraft: JSON.parse(JSON.stringify(updatedAircraft)),
    };
    const snapshots = [...state.replay.snapshots, newSnapshot].slice(-30);

    // Play blip sound on fresh contact update if audio enabled
    if (state.soundEnabled && newData.length > 0) {
      soundFx.playRadarBlip();
    }

    return {
      aircraft: updatedAircraft,
      events: [...newEvents, ...state.events].slice(0, 50),
      replay: {
        ...state.replay,
        snapshots,
      },
      health: {
        ...state.health,
        status: 'live',
        lastSuccessTime: timestamp,
        creditsRemaining: parseInt(credits, 10) || state.health.creditsRemaining || 950,
        errorCount: 0,
        latencyMs: latencyMs ?? state.health.latencyMs ?? 140,
        isCached: false,
      },
    };
  }),

  selectAircraft: (id) => {
    if (id && get().soundEnabled) {
      soundFx.playTargetLock();
    }
    set({ selectedId: id });
  },

  setHoveredId: (id) => set({ hoveredId: id }),

  setChaseCamera: (id) => set({ chaseCameraId: id }),

  setViewMode: (mode) => {
    if (get().soundEnabled) soundFx.playClick();
    set({ viewMode: mode });
  },

  setThemeMode: (mode) => {
    if (get().soundEnabled) soundFx.playClick();
    set({ themeMode: mode });
    if (typeof document !== 'undefined') {
      if (mode === 'day') {
        document.documentElement.classList.add('theme-day');
      } else {
        document.documentElement.classList.remove('theme-day');
      }
    }
  },

  setFilter: (updates) => set((state) => ({
    filters: { ...state.filters, ...updates },
  })),

  resetFilter: () => set({ filters: DEFAULT_FILTERS }),

  setChaos: (updates) => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => {
      const newChaos = { ...state.chaos, ...updates };
      if (newChaos.forceEmergencySquawk && !state.chaos.forceEmergencySquawk) {
        if (state.soundEnabled) soundFx.playEmergencyAlert();
      }
      return { chaos: newChaos };
    });
  },

  toggleRadarSweep: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({ radarSweepEnabled: !state.radarSweepEnabled }));
  },

  toggleDensityHeatmap: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({ densityHeatmapEnabled: !state.densityHeatmapEnabled }));
  },

  toggleRangeRings: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({ rangeRingsEnabled: !state.rangeRingsEnabled }));
  },

  toggleAltitudeCorridor: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({ altitudeCorridorOpen: !state.altitudeCorridorOpen }));
  },

  toggleSound: () => {
    const nextVal = soundFx.toggle();
    set({ soundEnabled: nextVal });
  },

  addEvent: (event) => set((state) => ({
    events: [
      {
        ...event,
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
      },
      ...state.events,
    ].slice(0, 50),
  })),

  setHealth: (updates) => set((state) => ({
    health: { ...state.health, ...updates },
  })),

  setSector: (sectorId) => {
    const target = SECTORS.find((s) => s.id === sectorId);
    if (!target) return;
    if (get().soundEnabled) soundFx.playClick();
    set({ activeSector: target, selectedId: null, chaseCameraId: null });
  },

  startReplay: () => {
    const { snapshots } = get().replay;
    if (snapshots.length === 0) return;
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({
      replay: {
        ...state.replay,
        isReplaying: true,
        currentIndex: 0,
        isPlaying: true,
      },
      aircraft: state.replay.snapshots[0].aircraft,
    }));
  },

  stopReplay: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({
      replay: {
        ...state.replay,
        isReplaying: false,
        isPlaying: false,
      },
    }));
  },

  setReplayIndex: (index) => {
    const { snapshots } = get().replay;
    if (index < 0 || index >= snapshots.length) return;
    set((state) => ({
      replay: { ...state.replay, currentIndex: index },
      aircraft: snapshots[index].aircraft,
    }));
  },

  setReplaySpeed: (speed) => set((state) => ({
    replay: { ...state.replay, speed },
  })),

  toggleReplayPlay: () => set((state) => ({
    replay: { ...state.replay, isPlaying: !state.replay.isPlaying },
  })),

  triggerMaydayAlert: () => {
    soundFx.playEmergencyAlert();
    set((state) => ({
      chaos: { ...state.chaos, forceEmergencySquawk: true },
      events: [
        {
          id: `mayday-${Date.now()}`,
          timestamp: Date.now(),
          type: 'emergency',
          callsign: 'MAYDAY-7700',
          message: 'EMERGENCY: Squawk 7700 declared in sector. Alerting all stations.',
        },
        ...state.events,
      ],
    }));
  },
}));
