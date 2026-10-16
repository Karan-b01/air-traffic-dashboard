// src/app/api/opensky/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';

// Server-side cache for fallback resilience
let lastValidResponse: {
  data: unknown;
  credits: string;
  fetchedAt: number;
} | null = null;

// Synthetic generator for realistic regional traffic if OpenSky is completely unreachable
function generateRealisticSectorPlanes(lamin: number, lomin: number, lamax: number, lomax: number) {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lamin = parseFloat(searchParams.get('lamin') || '8.0');
  const lomin = parseFloat(searchParams.get('lomin') || '68.0');
  const lamax = parseFloat(searchParams.get('lamax') || '37.0');
  const lomax = parseFloat(searchParams.get('lomax') || '97.0');

  // Chaos injection triggers
  const chaosRateLimit = searchParams.get('chaosRateLimit') === 'true';
  const chaosPacketLoss = searchParams.get('chaosPacketLoss') === 'true';

  if (chaosRateLimit) {
    return NextResponse.json(
      { error: 'OpenSky 429: Anonymous rate limit exceeded (Simulated Chaos)' },
      { status: 429, headers: { 'Retry-After': '10' } }
    );
  }

  if (chaosPacketLoss) {
    return NextResponse.json(
      { error: '503 Service Unavailable: Simulated packet loss anomaly' },
      { status: 503 }
    );
  }

  const targetUrl = `${OPENSKY_URL}?extended=1&lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  try {
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;
    const headers: HeadersInit = {};
    if (username && password) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    const response = await fetch(targetUrl, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // If 429 rate limit hit from OpenSky, fallback to cached data if available, but pass status
      if (response.status === 429 && lastValidResponse) {
        return NextResponse.json({
          data: lastValidResponse.data,
          credits: '0 (Rate Limited)',
          fetchedAt: lastValidResponse.fetchedAt,
          isCached: true,
          rateLimited: true,
        });
      }

      return NextResponse.json(
        { error: `OpenSky API Error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const remainingCredits = response.headers.get('X-Rate-Limit-Remaining') || '950';

    lastValidResponse = {
      data,
      credits: remainingCredits,
      fetchedAt: Date.now(),
    };

    return NextResponse.json({
      data,
      credits: remainingCredits,
      fetchedAt: Date.now(),
      isCached: false,
    });
  } catch (error) {
    // If upstream network fails, serve cache or fallback generator so experience remains rock solid
    if (lastValidResponse) {
      return NextResponse.json({
        data: lastValidResponse.data,
        credits: 'Offline Cache',
        fetchedAt: lastValidResponse.fetchedAt,
        isCached: true,
      });
    }

    const fallbackData = generateRealisticSectorPlanes(lamin, lomin, lamax, lomax);
    return NextResponse.json({
      data: fallbackData,
      credits: 'Radar Synthesis',
      fetchedAt: Date.now(),
      isCached: true,
    });
  }
}