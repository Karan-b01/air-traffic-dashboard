// src/lib/state/useAircraftStore.ts
import { create } from 'zustand';
import type { Aircraft } from '../opensky/types';
import type { FetchHealth, TrackedAircraft } from './types';

interface AircraftState {
  aircraft: Record<string, TrackedAircraft>;
  selectedId: string | null;
  health: FetchHealth;
  
  // Actions
  mergeUpdate: (newData: Aircraft[], timestamp: number, credits: string) => void;
  selectAircraft: (id: string | null) => void;
  setHealth: (updates: Partial<FetchHealth>) => void;
}

export const useAircraftStore = create<AircraftState>((set) => ({
  aircraft: {},
  selectedId: null,
  health: {
    status: 'live',
    lastSuccessTime: null,
    creditsRemaining: null,
    errorCount: 0,
    nextRefreshTime: null,
  },

  // The core of the app: Merging new data without wiping existing state
  mergeUpdate: (newData, timestamp, credits) => set((state) => {
    const updatedAircraft = { ...state.aircraft };

    newData.forEach((plane) => {
      const existing = updatedAircraft[plane.icao24];
      
      // Create a new position point for the history trail
      const newPosition = {
        longitude: plane.longitude,
        latitude: plane.latitude,
        altitude: plane.baroAltitude,
        timestamp
      };

      if (existing) {
        // Plane exists: Update it and append to history (max 50 points to save memory)
        const history = [...existing.history, newPosition].slice(-50); 
        updatedAircraft[plane.icao24] = {
          ...existing,
          ...plane,
          status: 'live', // Fresh data means it is live
          lastSeen: timestamp,
          history
        };
      } else {
        // New plane: Add it to the store
        updatedAircraft[plane.icao24] = {
          ...plane,
          status: 'live',
          firstSeen: timestamp,
          lastSeen: timestamp,
          history: [newPosition]
        };
      }
    });

    // Note: We will add the logic to mark planes as 'stale' or 'lost' in Phase 2
    
    return {
      aircraft: updatedAircraft,
      health: {
        ...state.health,
        status: 'live',
        lastSuccessTime: timestamp,
        creditsRemaining: parseInt(credits) || null,
        errorCount: 0, // Reset error count on a successful fetch
      }
    };
  }),

  selectAircraft: (id) => set({ selectedId: id }),
  setHealth: (updates) => set((state) => ({ health: { ...state.health, ...updates } })),
}));
