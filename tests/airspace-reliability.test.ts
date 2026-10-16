// tests/airspace-reliability.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Real application code imports (extensionless for standard TypeScript & runtime compatibility)
import { normalizeStateVector, normalizeOpenSkyResponse, mapOpenSkyCategory } from '../src/lib/opensky/normalizer';
import { projectCoordinates } from '../src/lib/deadReckoning';
import type { RawStateVector } from '../src/lib/opensky/types';
import {
  validateBoundingBox,
  clearSectorCacheForTesting,
  sectorCache,
  CACHE_TTL_MS,
  getSectorKey,
} from '../src/lib/opensky/routeUtils';
import { GET } from '../src/app/api/opensky/route';
import { calculateBackoffWithJitter, INITIAL_BACKOFF_MS, MAX_BACKOFF_MS } from '../src/hooks/usePolling';
import { useAircraftStore, SECTORS } from '../src/lib/state/useAircraftStore';
import type { Aircraft } from '../src/lib/opensky/types';

describe('1. Coordinate Validation & Null Island (0, 0) Elimination (Real Normalizer)', () => {
  it('should return null when longitude is null or undefined', () => {
    const rawWithNullLon: RawStateVector = [
      '80054a', 'AIC101', 'India', 1700000000, 1700000000,
      null, 13.0, 3000, false, 220, 90, 0, null, 3040, '1200', false, 0
    ];
    const result = normalizeStateVector(rawWithNullLon);
    assert.equal(result, null, 'Aircraft with null longitude must be rejected');
  });

  it('should return null when latitude is null or undefined', () => {
    const rawWithNullLat: RawStateVector = [
      '80054b', 'IGO202', 'India', 1700000000, 1700000000,
      77.5, null, 3000, false, 220, 90, 0, null, 3040, '1200', false, 0
    ];
    const result = normalizeStateVector(rawWithNullLat);
    assert.equal(result, null, 'Aircraft with null latitude must be rejected');
  });

  it('should return null when coordinates are NaN', () => {
    const rawWithNaN: RawStateVector = [
      '80054c', 'SEJ303', 'India', 1700000000, 1700000000,
      NaN, 13.0, 3000, false, 220, 90, 0, null, 3040, '1200', false, 0
    ];
    const result = normalizeStateVector(rawWithNaN);
    assert.equal(result, null, 'Aircraft with NaN coordinates must be rejected');
  });

  it('normalizeOpenSkyResponse filters out invalid positions so planes never appear at (0, 0)', () => {
    const mixedBatch: RawStateVector[] = [
      ['valid1', 'AIC101', 'India', 1700, 1700, 77.5, 12.9, 5000, false, 220, 90, 0, null, 5040, '1200', false, 0],
      ['null_lon', 'BAD01', 'Nowhere', 1700, 1700, null, 12.9, 5000, false, 220, 90, 0, null, 5040, '1200', false, 0],
      ['null_lat', 'BAD02', 'Nowhere', 1700, 1700, 77.5, null, 5000, false, 220, 90, 0, null, 5040, '1200', false, 0],
      ['valid2', 'VTI404', 'India', 1700, 1700, 78.1, 13.2, 8000, false, 250, 180, 2, null, 8040, '1200', false, 0],
    ];

    const clean = normalizeOpenSkyResponse(mixedBatch);
    assert.equal(clean.length, 2, 'Only 2 valid aircraft should be accepted');
    assert.equal(clean[0].icao24, 'valid1');
    assert.equal(clean[1].icao24, 'valid2');
    assert.ok(clean.every(p => p.longitude !== 0 && p.latitude !== 0), 'No plane should be at Null Island');
  });
});

describe('2. Bounding Box Validation (Real Route Handler)', () => {
  it('accepts valid bounding box coordinates within geographic limits', () => {
    const res = validateBoundingBox('8.0', '68.0', '37.0', '97.0');
    assert.equal(res.valid, true);
    assert.deepEqual(res.bbox, { lamin: 8.0, lomin: 68.0, lamax: 37.0, lomax: 97.0 });
  });

  it('falls back to default sector when coordinates are omitted', () => {
    const res = validateBoundingBox(null, null, null, null);
    assert.equal(res.valid, true);
    assert.ok(res.bbox && res.bbox.lamin === 8.0 && res.bbox.lamax === 37.0);
  });

  it('rejects malformed non-numeric values with descriptive error', () => {
    const res = validateBoundingBox('bad_val', '68.0', '37.0', '97.0');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Malformed coordinates/i);
  });

  it('rejects out-of-range latitude (> 90 or < -90)', () => {
    const res = validateBoundingBox('95.0', '68.0', '98.0', '97.0');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Out-of-range latitude/i);
  });

  it('rejects out-of-range longitude (> 180 or < -180)', () => {
    const res = validateBoundingBox('10.0', '-190.0', '20.0', '97.0');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Out-of-range longitude/i);
  });

  it('rejects inverted latitude range (lamin >= lamax)', () => {
    const res = validateBoundingBox('35.0', '68.0', '20.0', '97.0');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Invalid latitude range/i);
  });

  it('rejects inverted longitude range (lomin >= lomax)', () => {
    const res = validateBoundingBox('10.0', '90.0', '20.0', '80.0');
    assert.equal(res.valid, false);
    assert.match(res.error || '', /Invalid longitude range/i);
  });
});

describe('3. Real Route Handler Execution & Caching Behavior (src/app/api/opensky/route.ts)', () => {
  beforeEach(() => {
    clearSectorCacheForTesting();
  });

  it('returns HTTP 400 when malformed bounds are requested', async () => {
    const req = new Request('http://localhost:3000/api/opensky?lamin=50&lamax=20&lomin=68&lomax=97');
    const res = await GET(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Invalid latitude range/i);
  });

  it('returns HTTP 429 with Retry-After header when chaos rate limit is triggered', async () => {
    const req = new Request('http://localhost:3000/api/opensky?chaosRateLimit=true');
    const res = await GET(req);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('Retry-After'), '15');
    assert.equal(res.headers.get('X-Data-Source'), 'chaos-rate-limit');
  });

  it('returns HTTP 503 when chaos packet loss is triggered', async () => {
    const req = new Request('http://localhost:3000/api/opensky?chaosPacketLoss=true');
    const res = await GET(req);
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('X-Data-Source'), 'chaos-packet-loss');
  });

  it('serves cached sector response with X-Cache: HIT within 7.5s TTL and isolates sectors', async () => {
    // 1. First fetch for Sector A (India: 8, 68, 37, 97)
    const reqA1 = new Request('http://localhost:3000/api/opensky?lamin=8&lomin=68&lamax=37&lomax=97');
    const resA1 = await GET(reqA1);
    assert.ok(resA1.status === 200 || resA1.status === 429);
    const cacheKeyA = getSectorKey(8, 68, 37, 97);
    assert.ok(sectorCache.has(cacheKeyA), 'Sector A must be cached in memory');

    // 2. Second fetch for Sector A within TTL should hit cache
    const reqA2 = new Request('http://localhost:3000/api/opensky?lamin=8&lomin=68&lamax=37&lomax=97');
    const resA2 = await GET(reqA2);
    assert.equal(resA2.headers.get('X-Cache'), 'HIT');
    const bodyA2 = await resA2.json();
    assert.equal(bodyA2.isCached, true);

    // 3. Fetch for Sector B (Europe: 40, -5, 55, 20) must NOT hit Sector A's cache!
    const reqB = new Request('http://localhost:3000/api/opensky?lamin=40&lomin=-5&lamax=55&lomax=20');
    const resB = await GET(reqB);
    assert.notEqual(resB.headers.get('X-Cache'), 'HIT', 'Sector B must not share Sector A cache');
  });
});

describe('4. Exponential Backoff with Jitter & Retry-After (Real calculateBackoffWithJitter)', () => {
  it('applies initial backoff of 15s with +/- 15% uniform jitter', () => {
    const minJitter = calculateBackoffWithJitter(0, null, 0.0);   // randomFactor 0.0 -> 0.85
    const midJitter = calculateBackoffWithJitter(0, null, 0.5);   // randomFactor 0.5 -> 1.00
    const maxJitter = calculateBackoffWithJitter(0, null, 1.0);   // randomFactor 1.0 -> 1.15

    assert.equal(minJitter, Math.round(INITIAL_BACKOFF_MS * 0.85)); // 12,750 ms
    assert.equal(midJitter, INITIAL_BACKOFF_MS);                   // 15,000 ms
    assert.equal(maxJitter, Math.round(INITIAL_BACKOFF_MS * 1.15)); // 17,250 ms
  });

  it('progresses exponentially from 15s to 30s to 60s max with jitter', () => {
    // Second retry step (current = 15000 -> base 30000)
    const step2 = calculateBackoffWithJitter(15000, null, 0.5);
    assert.equal(step2, 30000);

    // Third retry step (current = 30000 -> base 60000 capped)
    const step3 = calculateBackoffWithJitter(30000, null, 0.5);
    assert.equal(step3, MAX_BACKOFF_MS);

    // Fourth retry step remains capped at 60000
    const step4 = calculateBackoffWithJitter(60000, null, 0.5);
    assert.equal(step4, MAX_BACKOFF_MS);
  });

  it('respects upstream server Retry-After header with decorrelated positive jitter', () => {
    // Upstream sends Retry-After: 45
    const backoffMin = calculateBackoffWithJitter(0, '45', 0.0); // +0%
    const backoffMax = calculateBackoffWithJitter(0, '45', 1.0); // +10%

    assert.equal(backoffMin, 45000);
    assert.equal(backoffMax, 49500);
    assert.ok(backoffMax > backoffMin, 'Positive jitter prevents simultaneous reconnect spikes');
  });
});

describe('5. 4-Stage Aircraft Lifecycle & 5-Minute Purge (Real Zustand Store)', () => {
  it('correctly transitions aircraft through live -> aging -> stale -> lost -> removed (5-min)', () => {
    const store = useAircraftStore.getState();
    const t0 = 1700000000000;

    const samplePlane: Aircraft = {
      icao24: 'test_lifecycle_01',
      callsign: 'VT-LFC',
      originCountry: 'India',
      timePosition: Math.floor(t0 / 1000),
      lastContact: Math.floor(t0 / 1000),
      longitude: 77.5,
      latitude: 12.9,
      baroAltitude: 5000,
      onGround: false,
      velocity: 220,
      heading: 90,
      verticalRate: 0,
      geoAltitude: 5040,
      squawk: '1200',
      positionSource: 0,
      category: 'airliner',
    };

    // 1. Initial Contact (t0): Status must be 'live'
    store.mergeUpdate([samplePlane], t0, '950', 120, 'live', false);
    let plane = useAircraftStore.getState().aircraft['test_lifecycle_01'];
    assert.ok(plane, 'Aircraft must exist in store');
    assert.equal(plane.status, 'live', 'T0: plane must be live');

    // 2. Age = 15s (> 10s and <= 25s): Transition to 'aging'
    store.pruneInactiveAircraft(t0 + 15000);
    plane = useAircraftStore.getState().aircraft['test_lifecycle_01'];
    assert.equal(plane.status, 'aging', 'T+15s: plane must transition to aging');

    // 3. Age = 35s (> 25s and <= 60s): Transition to 'stale'
    store.pruneInactiveAircraft(t0 + 35000);
    plane = useAircraftStore.getState().aircraft['test_lifecycle_01'];
    assert.equal(plane.status, 'stale', 'T+35s: plane must transition to stale');

    // 4. Age = 75s (> 60s and <= 300s): Transition to 'lost'
    store.pruneInactiveAircraft(t0 + 75000);
    plane = useAircraftStore.getState().aircraft['test_lifecycle_01'];
    assert.equal(plane.status, 'lost', 'T+75s: plane must transition to lost');

    // 5. Age = 305s (> 300s / 5 minutes): Automatically purged from store!
    store.pruneInactiveAircraft(t0 + 305000);
    const purged = useAircraftStore.getState().aircraft['test_lifecycle_01'];
    assert.equal(purged, undefined, 'T+305s: plane must be removed from store after 5 minutes');
  });
});

describe('6. Out-of-Order Telemetry Packet Protection (Real Zustand Store)', () => {
  it('rejects out-of-order packets and protects newer coordinates from regression', () => {
    const store = useAircraftStore.getState();
    const tNewer = 1700000020; // Newer packet timestamp

    const newerPlane: Aircraft = {
      icao24: 'test_ooo_02',
      callsign: 'VT-ORD',
      originCountry: 'India',
      timePosition: tNewer,
      lastContact: tNewer,
      longitude: 77.6,
      latitude: 13.0,
      baroAltitude: 6000,
      onGround: false,
      velocity: 240,
      heading: 100,
      verticalRate: 2,
      geoAltitude: 6040,
      squawk: '1200',
      positionSource: 0,
      category: 'airliner',
    };

    // Insert newer packet
    store.mergeUpdate([newerPlane], tNewer * 1000, '950', 100, 'live', false);
    const stored = useAircraftStore.getState().aircraft['test_ooo_02'];
    assert.equal(stored.longitude, 77.6);
    assert.equal(stored.latitude, 13.0);

    // Delayed out-of-order packet arrives from network with older timestamp
    const tOlder = 1700000010;
    const delayedPlane: Aircraft = {
      ...newerPlane,
      timePosition: tOlder,
      lastContact: tOlder,
      longitude: 76.5, // Old coordinates that would cause backwards jump
      latitude: 12.0,
    };

    // Feed older packet
    store.mergeUpdate([delayedPlane], tOlder * 1000, '950', 100, 'live', false);
    const protectedPlane = useAircraftStore.getState().aircraft['test_ooo_02'];

    // Coordinates MUST NOT have regressed!
    assert.equal(protectedPlane.longitude, 77.6, 'Longitude must not regress to older packet');
    assert.equal(protectedPlane.latitude, 13.0, 'Latitude must not regress to older packet');
  });
});

describe('7. Aircraft Category Classification & Heuristics (Real Normalizer)', () => {
  it('correctly maps raw transponder category codes', () => {
    assert.equal(mapOpenSkyCategory(7), 'helicopter');
    assert.equal(mapOpenSkyCategory(5), 'heavy');
    assert.equal(mapOpenSkyCategory(6), 'heavy');
    assert.equal(mapOpenSkyCategory(1), 'light');
    assert.equal(mapOpenSkyCategory(2), 'light');
    assert.equal(mapOpenSkyCategory(3), 'airliner');
  });

  it('falls back to heuristics when transponder category is missing', () => {
    // High altitude & high speed -> airliner
    const rawHighSpeed: RawStateVector = [
      '800111', 'AIC500', 'India', 1700, 1700, 77.5, 13.0, 10500, false, 250, 90, 0, null, 10540, '1200', false, 0
    ];
    const highSpeedPlane = normalizeStateVector(rawHighSpeed);
    assert.equal(highSpeedPlane?.category, 'airliner');

    // Low speed & low altitude -> light
    const rawLowSpeed: RawStateVector = [
      '800222', 'CESSNA', 'India', 1700, 1700, 77.5, 13.0, 800, false, 45, 90, 0, null, 820, '1200', false, 0
    ];
    const lowSpeedPlane = normalizeStateVector(rawLowSpeed);
    assert.equal(lowSpeedPlane?.category, 'light');
  });
});

describe('8. Geographic Boundary (Geofence) Alert Rule Evaluation (Real Store)', () => {
  it('triggers geofence alarm for terminal approach within 80km of sector center', () => {
    const store = useAircraftStore.getState();
    const sectorCenter = SECTORS[0].center; // [78.9629, 20.5937]

    // Position aircraft approx 20km from center
    const closePlane: Aircraft = {
      icao24: 'test_geo_03',
      callsign: 'GEO101',
      originCountry: 'India',
      timePosition: 1700000000,
      lastContact: 1700000000,
      longitude: sectorCenter[0] + 0.1,
      latitude: sectorCenter[1] + 0.1,
      baroAltitude: 3000,
      onGround: false,
      velocity: 200,
      heading: 90,
      verticalRate: 0,
      geoAltitude: 3040,
      squawk: '1200',
      positionSource: 0,
      category: 'airliner',
    };

    store.mergeUpdate([closePlane], 1700000000000, '950', 100, 'live', false);
    const events = useAircraftStore.getState().events;
    const geoAlert = events.find(e => e.type === 'alert_rule' && e.callsign === 'GEO101');
    assert.ok(geoAlert, 'Geofence terminal alert must be triggered for aircraft within boundary radius');
  });
});

describe('9. Partial Data Normalization & Edge Cases (Real Normalizer)', () => {
  it('normalizes aircraft with partial telemetry (missing altitude, speed, heading, squawk)', () => {
    const rawPartial: RawStateVector = [
      '800999', 'PARTIAL', 'India', 1700, 1700,
      77.5, 13.0, // valid lat/lon
      null, false, null, null, null, null, null, null, false, 0
    ];
    const plane = normalizeStateVector(rawPartial);
    assert.ok(plane, 'Aircraft with valid lat/lon and partial telemetry must be preserved');
    assert.equal(plane.baroAltitude, null);
    assert.equal(plane.velocity, null);
    assert.equal(plane.heading, null);
    assert.equal(plane.squawk, null);
  });

  it('correctly trims whitespace from callsigns', () => {
    const raw: RawStateVector = [
      '800888', '  AIC99   ', 'India', 1700, 1700, 77.5, 13.0, 4000, false, 200, 90, 0, null, 4040, '1200', false, 0
    ];
    const plane = normalizeStateVector(raw);
    assert.equal(plane?.callsign, 'AIC99');
  });

  it('handles short or malformed array without throwing', () => {
    // @ts-expect-error test malformed array
    const plane = normalizeStateVector(['short']);
    assert.equal(plane, null);
  });
});

describe('10. Large Aircraft Set Performance Benchmark (10,000 Aircraft Dead Reckoning)', () => {
  it('projects 10,000 aircraft with the production dead reckoning function', () => {
    const planeCount = 10000;
    const aircraft = Array.from({ length: planeCount }, (_, i) => ({
      lat: 10 + (i % 75) * 0.3,
      lon: 70 + (i % 100) * 0.3,
      speedMs: 200 + (i % 50),
      heading: (i * 17) % 360,
    }));

    const tStart = performance.now();
    const projected = aircraft.map((plane) =>
      projectCoordinates(plane.lat, plane.lon, plane.speedMs, plane.heading, 1)
    );
    const duration = performance.now() - tStart;

    assert.equal(projected.length, planeCount);
    assert.ok(projected.every((point) =>
      Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    ), 'Every projected position must remain finite');
    // A generous regression guard for CI hardware; this does not measure map/WebGL frame rate.
    assert.ok(duration < 100, `10,000 projections took ${duration.toFixed(2)}ms (expected <100ms)`);
  });
});
