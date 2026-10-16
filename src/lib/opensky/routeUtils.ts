// src/lib/opensky/routeUtils.ts

export const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
export const CACHE_TTL_MS = 7500; // 7.5 seconds sector cache TTL

export interface SectorCacheEntry {
  data: unknown;
  credits: string;
  fetchedAt: number;
  isSimulated: boolean;
  dataSource: 'live' | 'cache' | 'simulated';
}

export interface BoundingBoxValidation {
  valid: boolean;
  error?: string;
  bbox?: {
    lamin: number;
    lomin: number;
    lamax: number;
    lomax: number;
  };
}

// Sector-specific cache keyed by bounding box coordinates
export const sectorCache = new Map<string, SectorCacheEntry>();

// In-flight request collapsing (deduplication) to ensure concurrent requests for the same sector trigger only 1 upstream query
export const inFlightRequests = new Map<string, Promise<{ data: unknown; credits: string; rateLimited?: boolean; retryAfter?: string }>>();

export function getSectorKey(lamin: number, lomin: number, lamax: number, lomax: number): string {
  return `${lamin.toFixed(3)}_${lomin.toFixed(3)}_${lamax.toFixed(3)}_${lomax.toFixed(3)}`;
}

export function clearSectorCacheForTesting() {
  sectorCache.clear();
  inFlightRequests.clear();
}

/**
 * Validates bounding box parameters according to WGS-84 coordinate limits
 * and geometric bounding box constraints.
 */
export function validateBoundingBox(
  laminRaw: string | null,
  lominRaw: string | null,
  lamaxRaw: string | null,
  lomaxRaw: string | null
): BoundingBoxValidation {
  // If all parameters are omitted, fallback to default India Sector bounds
  const lamin = parseFloat(laminRaw ?? '8.0');
  const lomin = parseFloat(lominRaw ?? '68.0');
  const lamax = parseFloat(lamaxRaw ?? '37.0');
  const lomax = parseFloat(lomaxRaw ?? '97.0');

  if (Number.isNaN(lamin) || Number.isNaN(lomin) || Number.isNaN(lamax) || Number.isNaN(lomax)) {
    return {
      valid: false,
      error: 'Malformed coordinates: lamin, lomin, lamax, and lomax must be valid floating-point numbers',
    };
  }

  if (lamin < -90 || lamin > 90 || lamax < -90 || lamax > 90) {
    return {
      valid: false,
      error: 'Out-of-range latitude: lamin and lamax must be within [-90, 90]',
    };
  }

  if (lomin < -180 || lomin > 180 || lomax < -180 || lomax > 180) {
    return {
      valid: false,
      error: 'Out-of-range longitude: lomin and lomax must be within [-180, 180]',
    };
  }

  if (lamin >= lamax) {
    return {
      valid: false,
      error: `Invalid latitude range: lamin (${lamin}) must be strictly less than lamax (${lamax})`,
    };
  }

  if (lomin >= lomax) {
    return {
      valid: false,
      error: `Invalid longitude range: lomin (${lomin}) must be strictly less than lomax (${lomax})`,
    };
  }

  return {
    valid: true,
    bbox: { lamin, lomin, lamax, lomax },
  };
}

// Synthetic generator for realistic regional traffic if OpenSky is completely unreachable
export function generateRealisticSectorPlanes(lamin: number, lomin: number, lamax: number, lomax: number) {
  const airlines = [
    { prefix: 'AIC', country: 'India' },
    { prefix: 'IGO', country: 'India' },
    { prefix: 'SEJ', country: 'India' },
    { prefix: 'VTI', country: 'India' },
    { prefix: 'UAE', country: 'United Arab Emirates' },
    { prefix: 'SIA', country: 'Singapore' },
    { prefix: 'BAW', country: 'United Kingdom' },
    { prefix: 'QFA', country: 'Australia' },
  ];

  const now = Math.floor(Date.now() / 1000);
  const states = [];

  for (let i = 0; i < 18; i++) {
    const airline = airlines[i % airlines.length];
    const flightNum = 100 + (i * 37) % 890;
    const callsign = `${airline.prefix}${flightNum}`.padEnd(8, ' ');
    const icao24 = `800${i.toString(16).padStart(3, '0')}`;
    const lat = lamin + (lamax - lamin) * (0.15 + 0.7 * ((i * 0.17) % 1));
    const lon = lomin + (lomax - lomin) * (0.15 + 0.7 * ((i * 0.23) % 1));
    const alt = 2500 + ((i * 1200) % 9500);
    const speed = 190 + (i * 25) % 180;
    const heading = (i * 47) % 360;
    const vrate = i % 3 === 0 ? 3.5 : i % 3 === 1 ? -2.8 : 0;
    const squawk = i === 0 ? '7700' : `${1000 + (i * 123) % 6000}`;

    states.push([
      icao24,
      callsign,
      airline.country,
      now,
      now,
      lon,
      lat,
      alt,
      false,
      speed,
      heading,
      vrate,
      null,
      alt + 40,
      squawk,
      false,
      0,
      i % 6 === 0 ? 7 : i % 5 === 0 ? 5 : i % 4 === 0 ? 1 : 3,
    ]);
  }

  return {
    time: now,
    states,
  };
}

