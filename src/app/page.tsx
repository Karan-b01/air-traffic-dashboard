// src/app/page.tsx
'use client';

import AircraftMap from '../components/map/AircraftMap';
import { usePolling } from '../hooks/usePolling';

export default function Home() {
  // Start polling every 10 seconds
  usePolling(10000);

  return (
    <main className="dashboard">
      {/* CodeChef-VIT Themed Header */}
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            CC-VIT <span className="text-white">AIRSPACE</span>
          </h1>
          <p className="dashboard-subtitle">Live Traffic Dashboard</p>
        </div>
      </header>

      {/* The WebGL Map */}
      <AircraftMap />
      
      {/* We will add the UI Panels (Details, Health) here next! */}
    </main>
  );
}
