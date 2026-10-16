// src/lib/opensky/normalizer.ts
import type { RawStateVector, Aircraft } from '../../../lib/opensky/types';

/**
 * Converts the raw OpenSky array into a clean, safe Aircraft object.
 * Replaces undefined/missing critical fields with safe defaults where necessary.
 */
export function normalizeStateVector(raw: RawStateVector): Aircraft {
  return {
    icao24: raw[0],
    callsign: raw[1] ? raw[1].trim() : 'UNKNOWN', // Callsigns often have trailing spaces
    originCountry: raw[2],
    timePosition: raw[3],
    lastContact: raw[4],
    longitude: raw[5] ?? 0, // Fallback to 0, though we will filter out 0,0 later
    latitude: raw[6] ?? 0,
    baroAltitude: raw[7],
    onGround: raw[8],
    velocity: raw[9],
    heading: raw[10],
    verticalRate: raw[11],
    geoAltitude: raw[13],
    squawk: raw[14],
    positionSource: raw[16],
  };
}