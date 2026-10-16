import type { RawStateVector, Aircraft, AircraftCategory } from './types';

/**
 * Maps OpenSky ADS-B category code to application silhouette category.
 * OpenSky categories:
 * 1 = Light (<15,500 lbs)
 * 2 = Small (15,500 - 75,000 lbs)
 * 3 = Large (75,000 - 300,000 lbs, e.g. A320, B737)
 * 4 = High-Vortex Large (B757)
 * 5 = Heavy (>300,000 lbs, e.g. B777, A350, B747, A380)
 * 6 = High Performance
 * 7 = Rotorcraft / Helicopter
 */
export function mapOpenSkyCategory(
  rawCat?: number | null,
  velocity?: number | null,
  altitude?: number | null
): AircraftCategory {
  if (rawCat != null) {
    if (rawCat === 7) return 'helicopter';
    if (rawCat === 5 || rawCat === 6) return 'heavy';
    if (rawCat === 1 || rawCat === 2 || rawCat === 8 || rawCat === 11 || rawCat === 14) return 'light';
    if (rawCat === 3 || rawCat === 4) return 'airliner';
  }

  // Heuristic fallbacks if transponder didn't broadcast category field
  if (velocity != null && velocity > 0 && velocity < 55 && altitude != null && altitude < 1500) {
    return 'helicopter';
  }
  if (altitude != null && altitude > 10500) {
    return 'heavy';
  }

  return 'airliner';
}

/**
 * Converts raw OpenSky array into a clean, safe Aircraft object.
 */
export function normalizeStateVector(raw: RawStateVector): Aircraft {
  const vel = raw[9];
  const alt = raw[7];
  const rawCategory = typeof raw[17] === 'number' ? raw[17] : undefined;

  return {
    icao24: raw[0],
    callsign: raw[1] ? raw[1].trim() : 'UNKNOWN',
    originCountry: raw[2],
    timePosition: raw[3],
    lastContact: raw[4],
    longitude: raw[5] ?? 0,
    latitude: raw[6] ?? 0,
    baroAltitude: alt,
    onGround: raw[8],
    velocity: vel,
    heading: raw[10],
    verticalRate: raw[11],
    geoAltitude: raw[13],
    squawk: raw[14],
    positionSource: raw[16],
    category: mapOpenSkyCategory(rawCategory, vel, alt),
  };
}
