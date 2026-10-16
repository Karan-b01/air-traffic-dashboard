// src/app/api/opensky/route.ts
import { NextResponse } from 'next/server';
export const revalidate = 5; // Cache for 5 seconds to prevent spamming

// We define the OpenSky URL here
const OPENSKY_URL = 'https://opensky-network.org/api/states/all';

export async function GET(request: Request) {
  // 1. Get the bounding box from the frontend request URL
  const { searchParams } = new URL(request.url);
  const lamin = searchParams.get('lamin');
  const lomin = searchParams.get('lomin');
  const lamax = searchParams.get('lamax');
  const lomax = searchParams.get('lomax');

  // Validate that we have a bounding box
  if (!lamin || !lomin || !lamax || !lomax) {
    return NextResponse.json({ error: 'Bounding box parameters are required' }, { status: 400 });
  }

  // Build the OpenSky Request URL
  const targetUrl = `${OPENSKY_URL}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  try {
    // 2. Setup credentials from environment variables (Safe on the server!)
    // If you haven't made an account yet, this will just run anonymously for now
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;
    
    const headers: HeadersInit = {};
    if (username && password) {
      // Basic Auth encoding for OpenSky
      headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    }

    // 3. Fetch from OpenSky
   
    // We will add custom caching here later for the "Chaos Mode" and rate limit protection
    const response = await fetch(targetUrl, {
      headers,
    }); // Cache for 5 seconds to prevent spamming

    if (!response.ok) {
      // Pass OpenSky's error (like 429 Rate Limit) down to our frontend so we can trigger the "Chaos" UI
      return NextResponse.json({ error: `OpenSky API Error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    
    // We also want to forward the Rate Limit headers so our frontend "Data Health" panel can see them!
    const remainingCredits = response.headers.get('X-Rate-Limit-Remaining') || 'Unknown';

    return NextResponse.json({
      data: data,
      credits: remainingCredits,
      fetchedAt: Date.now()
    });

  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json({ error: 'Internal Server Error fetching from OpenSky' }, { status: 500 });
  }
}