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
  UnitSystem,
  ViewMode,
} from './types';
import { soundFx } from '../audio/AudioSynthesizer';
import {
  persistSectorSnapshot,
  loadCachedSnapshot,
  saveAlertRule,
  deleteAlertRule,
  type AlertRule,
} from '../persistence/db';

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
  hoveredId: string | null;
  chaseCameraId: string | null;
  health: FetchHealth;
  viewMode: ViewMode;
  themeMode: ThemeMode;
  unitSystem: UnitSystem;
  filters: AirspaceFilter;
  chaos: ChaosSettings;
  radarSweepEnabled: boolean;
  densityHeatmapEnabled: boolean;
  rangeRingsEnabled: boolean;
  altitudeCorridorOpen: boolean;
  analyticsOpen: boolean;
  alertsModalOpen: boolean;
  tableViewOpen: boolean;
  onboardingDismissed: boolean;
  soundEnabled: boolean;
  events: AtcEvent[];
  replay: ReplayState;
  activeSector: SectorConfig;
  alertRules: AlertRule[];

  // Actions
  mergeUpdate: (
    newData: Aircraft[],
    timestamp: number,
    credits: string,
    latencyMs?: number,
    dataSource?: 'live' | 'cache' | 'simulated',
    isSimulated?: boolean
  ) => void;
  pruneInactiveAircraft: (now?: number) => void;
  selectAircraft: (id: string | null) => void;
  setHoveredId: (id: string | null) => void;
  setChaseCamera: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setUnitSystem: (unit: UnitSystem) => void;
  setFilter: (updates: Partial<AirspaceFilter>) => void;
  resetFilter: () => void;
  setChaos: (updates: Partial<ChaosSettings>) => void;
  toggleRadarSweep: () => void;
  toggleDensityHeatmap: () => void;
  toggleRangeRings: () => void;
  toggleAltitudeCorridor: () => void;
  toggleAnalytics: () => void;
  toggleAlertsModal: () => void;
  toggleTableView: () => void;
  setOnboardingDismissed: (dismissed: boolean) => void;
  toggleSound: () => void;
  addEvent: (event: Omit<AtcEvent, 'id' | 'timestamp'>) => void;
  setHealth: (updates: Partial<FetchHealth>) => void;
  setSector: (sectorId: string) => void;
  restoreFromIndexedDB: (sectorId: string) => Promise<void>;

  // Alert Rules Actions
  addAlertRule: (rule: Omit<AlertRule, 'id'>) => void;
  toggleAlertRule: (id: string) => void;
  removeAlertRule: (id: string) => void;

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

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'rule-low-alt',
    name: 'Low Altitude Warning (<1500m)',
    field: 'altitude',
    operator: '<',
    value: 1500,
    enabled: true,
  },
  {
    id: 'rule-geofence',
    name: 'Terminal Approach Geofence (<80 km)',
    field: 'geofence',
    operator: '<',
    value: 80,
    enabled: true,
  },
  {
    id: 'rule-high-speed',
    name: 'High Speed Intercept (>900 km/h)',
    field: 'speed',
    operator: '>',
    value: 900,
    enabled: false,
  },
];

export const useAircraftStore = create<AircraftState>((set, get) => ({
  aircraft: {},
  selectedId: null,
  hoveredId: null,
  chaseCameraId: null,
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
  viewMode: '3d',
  themeMode: 'night',
  unitSystem: 'aviation',
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
  analyticsOpen: false,
  alertsModalOpen: false,
  tableViewOpen: false,
  onboardingDismissed: typeof window !== 'undefined' ? localStorage.getItem('atc_onboarding_seen') === 'true' : false,
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
  alertRules: DEFAULT_ALERT_RULES,

  mergeUpdate: (newData, timestamp, credits, latencyMs, dataSource, isSimulated) => set((state) => {
    if (state.replay.isReplaying || state.chaos.forceOffline) return {};

    const updatedAircraft = { ...state.aircraft };
    const newEvents: AtcEvent[] = [];
    const chaosEmergency = state.chaos.forceEmergencySquawk;
    const chaosJitter = state.chaos.forceGpsJitter;

    newData.forEach((plane, index) => {
      let lon = plane.longitude;
      let lat = plane.latitude;
      if (chaosJitter) {
        lon += (Math.random() - 0.5) * 0.08;
        lat += (Math.random() - 0.5) * 0.08;
      }

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
        // Out-of-order update protection:
        // In distributed ADS-B networks, delayed packets can arrive out-of-order.
        // If the incoming packet has an earlier lastContact or timestamp than what
        // we've already processed for this aircraft, discard it to prevent position/time regression!
        const existingTime = existing.lastContact ?? existing.lastSeen;
        const incomingTime = plane.lastContact ?? timestamp;
        if (incomingTime < existingTime) {
          return;
        }

        // Significant altitude climb or descent event
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
        // Sector entry event
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

      // Check User Alert Rules
      state.alertRules.forEach((rule) => {
        if (!rule.enabled) return;
        const callsign = plane.callsign.trim() || plane.icao24.toUpperCase();
        let val: number | null = null;
        if (rule.field === 'altitude') val = plane.baroAltitude;
        if (rule.field === 'speed') val = plane.velocity != null ? plane.velocity * 3.6 : null;
        if (rule.field === 'verticalRate') val = plane.verticalRate;
        if (rule.field === 'geofence') {
          // Calculate distance in km from active sector center
          const [cLon, cLat] = state.activeSector.center;
          const dLat = ((lat - cLat) * Math.PI) / 180;
          const dLon = ((lon - cLon) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((cLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          val = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        if (val != null) {
          const match =
            (rule.operator === '<' && val < rule.value) ||
            (rule.operator === '>' && val > rule.value) ||
            (rule.operator === '==' && Math.round(val) === rule.value);

          if (match && (!rule.lastTriggered || timestamp - rule.lastTriggered > 60000)) {
            rule.lastTriggered = timestamp;
            const unitSuffix =
              rule.field === 'altitude' ? 'm' : rule.field === 'speed' ? 'km/h' : rule.field === 'geofence' ? 'km' : 'm/s';
            newEvents.push({
              id: `${plane.icao24}-alert-${timestamp}`,
              timestamp,
              type: 'alert_rule',
              callsign,
              message: `ALERT TRIGGERED: ${rule.name} (${Math.round(val)}${unitSuffix})`,
            });
            if (state.soundEnabled) soundFx.playEmergencyAlert();
          }
        }
      });
    });

    // Mark missing aircraft: live (<=10s), aging (10-25s), stale (25-60s), lost (>60s), remove (>300s / 5 min)
    const now = timestamp;
    for (const icao in updatedAircraft) {
      const plane = updatedAircraft[icao];
      const age = now - plane.lastSeen;
      if (age > 300000) {
        // Enforce 5-minute automatic removal
        delete updatedAircraft[icao];
      } else if (age > 60000) {
        plane.status = 'lost';
      } else if (age > 25000) {
        plane.status = 'stale';
      } else if (age > 10000) {
        plane.status = 'aging';
      }
    }

    // Persist snapshot to IndexedDB for offline resumption
    persistSectorSnapshot(state.activeSector.id, updatedAircraft);

    // Save snapshot for Blackbox Replay mode
    const newSnapshot: ReplaySnapshot = {
      timestamp,
      aircraft: JSON.parse(JSON.stringify(updatedAircraft)),
    };
    const snapshots = [...state.replay.snapshots, newSnapshot].slice(-30);

    const resolvedDataSource = dataSource || (isSimulated ? 'simulated' : 'live');

    return {
      aircraft: updatedAircraft,
      selectedId: state.selectedId && !updatedAircraft[state.selectedId] ? null : state.selectedId,
      events: [...newEvents, ...state.events].slice(0, 50),
      replay: {
        ...state.replay,
        snapshots,
      },
      health: {
        ...state.health,
        status: 'live',
        dataSource: resolvedDataSource,
        isSimulated: Boolean(isSimulated || resolvedDataSource === 'simulated'),
        lastSuccessTime: timestamp,
        creditsRemaining: parseInt(credits, 10) || state.health.creditsRemaining || 950,
        errorCount: 0,
        latencyMs: latencyMs ?? state.health.latencyMs ?? 140,
        isCached: resolvedDataSource === 'cache' || state.health.isCached,
        retryCountdown: 0,
      },
    };
  }),

  pruneInactiveAircraft: (now = Date.now()) => set((state) => {
    let changed = false;
    const updated = { ...state.aircraft };
    for (const icao in updated) {
      const plane = updated[icao];
      const age = now - plane.lastSeen;
      if (age > 300000) {
        delete updated[icao];
        changed = true;
      } else if (age > 60000 && plane.status !== 'lost') {
        updated[icao] = { ...plane, status: 'lost' };
        changed = true;
      } else if (age > 25000 && plane.status !== 'stale') {
        updated[icao] = { ...plane, status: 'stale' };
        changed = true;
      } else if (age > 10000 && plane.status !== 'aging') {
        updated[icao] = { ...plane, status: 'aging' };
        changed = true;
      } else if (age <= 10000 && plane.status !== 'live') {
        updated[icao] = { ...plane, status: 'live' };
        changed = true;
      }
    }
    if (!changed) return {};
    return {
      aircraft: updated,
      selectedId: state.selectedId && !updated[state.selectedId] ? null : state.selectedId,
    };
  }),

  restoreFromIndexedDB: async (sectorId) => {
    const cached = await loadCachedSnapshot(sectorId);
    if (cached && Object.keys(cached.aircraft).length > 0) {
      set((state) => ({
        aircraft: cached.aircraft,
        health: {
          ...state.health,
          isCached: true,
          lastSuccessTime: cached.timestamp,
        },
      }));
    }
  },

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

  setUnitSystem: (unit) => {
    if (get().soundEnabled) soundFx.playClick();
    set({ unitSystem: unit });
    if (typeof window !== 'undefined') {
      localStorage.setItem('atc_unit_system', unit);
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

  toggleAnalytics: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({ analyticsOpen: !state.analyticsOpen }));
  },

  toggleAlertsModal: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({ alertsModalOpen: !state.alertsModalOpen }));
  },

  toggleTableView: () => {
    if (get().soundEnabled) soundFx.playClick();
    set((state) => ({ tableViewOpen: !state.tableViewOpen }));
  },

  setOnboardingDismissed: (dismissed) => {
    set({ onboardingDismissed: dismissed });
    if (typeof window !== 'undefined') {
      localStorage.setItem('atc_onboarding_seen', String(dismissed));
    }
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
    get().restoreFromIndexedDB(sectorId);
  },

  addAlertRule: (rule) => {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}`,
    };
    saveAlertRule(newRule);
    set((state) => ({ alertRules: [...state.alertRules, newRule] }));
  },

  toggleAlertRule: (id) => {
    set((state) => {
      const updated = state.alertRules.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      );
      const rule = updated.find((r) => r.id === id);
      if (rule) saveAlertRule(rule);
      return { alertRules: updated };
    });
  },

  removeAlertRule: (id) => {
    deleteAlertRule(id);
    set((state) => ({
      alertRules: state.alertRules.filter((r) => r.id !== id),
    }));
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
