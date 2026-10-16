// src/lib/persistence/db.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TrackedAircraft } from '../state/types';

export interface AlertRule {
  id: string;
  name: string;
  field: 'altitude' | 'speed' | 'verticalRate' | 'geofence';
  operator: '<' | '>' | '==';
  value: number;
  enabled: boolean;
  lastTriggered?: number;
}

interface AirspaceDBSchema extends DBSchema {
  snapshots: {
    key: string; // sectorId
    value: {
      sectorId: string;
      timestamp: number;
      aircraft: Record<string, TrackedAircraft>;
    };
  };
  alerts: {
    key: string;
    value: AlertRule;
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'airspace_vector_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AirspaceDBSchema>> | null = null;

function getDb() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<AirspaceDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'sectorId' });
        }
        if (!db.objectStoreNames.contains('alerts')) {
          db.createObjectStore('alerts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

let lastSaveTime = 0;

/**
 * Throttled write of sector snapshot to IndexedDB (max once every 8s).
 */
export async function persistSectorSnapshot(
  sectorId: string,
  aircraft: Record<string, TrackedAircraft>
): Promise<void> {
  const now = Date.now();
  if (now - lastSaveTime < 8000) return;
  lastSaveTime = now;

  try {
    const db = await getDb();
    if (!db) return;
    await db.put('snapshots', {
      sectorId,
      timestamp: now,
      aircraft,
    });
  } catch (err) {
    console.warn('IndexedDB write deferred:', err);
  }
}

/**
 * Restores the most recent cached snapshot for a sector from IndexedDB.
 */
export async function loadCachedSnapshot(
  sectorId: string
): Promise<{ timestamp: number; aircraft: Record<string, TrackedAircraft> } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const record = await db.get('snapshots', sectorId);
    if (!record) return null;
    return {
      timestamp: record.timestamp,
      aircraft: record.aircraft,
    };
  } catch (err) {
    console.warn('IndexedDB read fallback:', err);
    return null;
  }
}

/**
 * Loads all saved user alert rules.
 */
export async function loadAlertRules(): Promise<AlertRule[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    return await db.getAll('alerts');
  } catch {
    return [];
  }
}

/**
 * Saves or updates an alert rule in IndexedDB.
 */
export async function saveAlertRule(rule: AlertRule): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.put('alerts', rule);
  } catch (err) {
    console.warn('Could not save alert rule:', err);
  }
}

/**
 * Deletes an alert rule from IndexedDB.
 */
export async function deleteAlertRule(ruleId: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete('alerts', ruleId);
  } catch (err) {
    console.warn('Could not delete alert rule:', err);
  }
}

