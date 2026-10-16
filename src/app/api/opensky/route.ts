// src/app/api/opensky/route.ts
import { NextResponse } from 'next/server';
import {
  OPENSKY_URL,
  CACHE_TTL_MS,
  type SectorCacheEntry,
  sectorCache,
  inFlightRequests,
  getSectorKey,
  validateBoundingBox,
  generateRealisticSectorPlanes,
} from '../../../lib/opensky/routeUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Strict Bounding Box Validation
  const validation = validateBoundingBox(
    searchParams.get('lamin'),
    searchParams.get('lomin'),
    searchParams.get('lamax'),
    searchParams.get('lomax')
  );

  if (!validation.valid || !validation.bbox) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400, headers: { 'X-Data-Source': 'validation-error' } }
    );
  }

  const { lamin, lomin, lamax, lomax } = validation.bbox;

  // Chaos injection triggers
  const chaosRateLimit = searchParams.get('chaosRateLimit') === 'true';
  const chaosPacketLoss = searchParams.get('chaosPacketLoss') === 'true';

  if (chaosRateLimit) {
    return NextResponse.json(
      { error: 'OpenSky 429: Anonymous rate limit exceeded (Simulated Chaos)' },
      { status: 429, headers: { 'Retry-After': '15', 'X-Data-Source': 'chaos-rate-limit' } }
    );
  }

  if (chaosPacketLoss) {
    return NextResponse.json(
      { error: '503 Service Unavailable: Simulated packet loss anomaly' },
      { status: 503, headers: { 'X-Data-Source': 'chaos-packet-loss' } }
    );
  }

  const sectorKey = getSectorKey(lamin, lomin, lamax, lomax);
  const now = Date.now();

  // 2. Sector-Specific Timed Cache Check (7.5s TTL)
  const cached = sectorCache.get(sectorKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        data: cached.data,
        credits: cached.credits,
        fetchedAt: cached.fetchedAt,
        isCached: true,
        isSimulated: cached.isSimulated,
        dataSource: cached.dataSource,
      },
      {
        headers: {
          'X-Cache': 'HIT',
          'X-Cache-Age-Ms': String(now - cached.fetchedAt),
          'X-Data-Source': cached.dataSource,
        },
      }
    );
  }

  // 3. In-Flight Request Collapsing (Deduplication)
  let pendingFetch = inFlightRequests.get(sectorKey);
  if (!pendingFetch) {
    const targetUrl = `${OPENSKY_URL}?extended=1&lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;
    const headers: HeadersInit = {};
    if (username && password) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    }

    pendingFetch = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      try {
        const response = await fetch(targetUrl, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '15';
            return {
              data: null,
              credits: '0 (Rate Limited)',
              rateLimited: true,
              retryAfter,
            };
          }
          throw new Error(`OpenSky HTTP ${response.status}`);
        }

        const data = await response.json();
        const credits = response.headers.get('X-Rate-Limit-Remaining') || '950';
        return { data, credits };
      } finally {
        clearTimeout(timeoutId);
        inFlightRequests.delete(sectorKey);
      }
    })();

    inFlightRequests.set(sectorKey, pendingFetch);
  }

  try {
    const result = await pendingFetch;

    // Handle rate-limited upstream response
    if (result.rateLimited) {
      const retryAfter = result.retryAfter || '15';
      const fallbackData = cached ? cached.data : generateRealisticSectorPlanes(lamin, lomin, lamax, lomax);
      return NextResponse.json(
        {
          error: 'OpenSky 429: Anonymous rate limit exceeded',
          data: fallbackData,
          credits: '0 (Rate Limited)',
          fetchedAt: cached ? cached.fetchedAt : now,
          isCached: Boolean(cached),
          isSimulated: !cached,
          dataSource: cached ? 'cache' : 'simulated',
          rateLimited: true,
          retryAfter: parseInt(retryAfter, 10),
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter,
            'X-Data-Source': cached ? 'cache-rate-limit' : 'simulated-rate-limit',
            'X-Cache': cached ? 'STALE' : 'MISS',
          },
        }
      );
    }

    const { data, credits } = result;

    // Cache successful response for this sector
    const entry: SectorCacheEntry = {
      data,
      credits,
      fetchedAt: now,
      isSimulated: false,
      dataSource: 'live',
    };
    sectorCache.set(sectorKey, entry);

    return NextResponse.json(
      {
        data,
        credits,
        fetchedAt: now,
        isCached: false,
        isSimulated: false,
        dataSource: 'live',
      },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-Data-Source': 'live',
        },
      }
    );
  } catch {
    // 4. Sector-Specific Fallback Strategy
    if (cached) {
      return NextResponse.json(
        {
          data: cached.data,
          credits: 'Sector Cache (Stale)',
          fetchedAt: cached.fetchedAt,
          isCached: true,
          isSimulated: cached.isSimulated,
          dataSource: 'cache',
          rateLimited: true,
        },
        {
          headers: {
            'X-Cache': 'STALE-FALLBACK',
            'X-Data-Source': 'cache',
          },
        }
      );
    }

    const fallbackData = generateRealisticSectorPlanes(lamin, lomin, lamax, lomax);
    const syntheticEntry: SectorCacheEntry = {
      data: fallbackData,
      credits: 'Radar Synthesis (Simulated)',
      fetchedAt: now,
      isSimulated: true,
      dataSource: 'simulated',
    };
    sectorCache.set(sectorKey, syntheticEntry);

    return NextResponse.json(
      {
        data: fallbackData,
        credits: 'Radar Synthesis (Simulated)',
        fetchedAt: now,
        isCached: true,
        isSimulated: true,
        dataSource: 'simulated',
      },
      {
        headers: {
          'X-Cache': 'SYNTHETIC-FALLBACK',
          'X-Data-Source': 'simulated',
        },
      }
    );
  }
}