# CC-VIT Airspace

A live air traffic dashboard built with Next.js, MapLibre GL, and OpenSky data.

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and optionally add OpenSky credentials.
3. Start the development server with `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000).

The OpenSky credentials are optional. They are read by the server-side API route and are not exposed to the browser.

## Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm start` serves the production build.
