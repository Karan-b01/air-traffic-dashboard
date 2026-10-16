// src/components/map/WebGLFallbackTable.tsx
'use client';

import { Activity, ArrowUpRight, Compass, Plane, ShieldAlert } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

export default function WebGLFallbackTable() {
  const aircraft = useAircraftStore((state) => state.aircraft);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const selectedId = useAircraftStore((state) => state.selectedId);

  const aircraftList = Object.values(aircraft);

  return (
    <div className="webgl-fallback-container radar-glass-panel">
      <div className="fallback-banner">
        <ShieldAlert size={16} className="text-amber-400" />
        <span>WEBGL ACCELERATION UNAVAILABLE · 2D TELEMETRY TABLE FALLBACK ACTIVE</span>
      </div>

      <div className="fallback-table-wrap">
        <table className="fallback-table font-mono">
          <thead>
            <tr>
              <th>CALLSIGN</th>
              <th>ICAO24</th>
              <th>COUNTRY</th>
              <th>ALTITUDE</th>
              <th>GROUND SPEED</th>
              <th>HEADING</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {aircraftList.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  No aircraft contacts reported in this sector.
                </td>
              </tr>
            ) : (
              aircraftList.map((plane) => {
                const isSelected = plane.icao24 === selectedId;
                const alt = plane.baroAltitude
                  ? `${Math.round(plane.baroAltitude).toLocaleString()}m (FL${Math.round((plane.baroAltitude * 3.28084) / 100)})`
                  : 'GND';
                const speed = plane.velocity != null ? `${Math.round(plane.velocity * 3.6)} km/h` : '—';
                const heading = plane.heading != null ? `${Math.round(plane.heading)}°` : '—';

                return (
                  <tr
                    key={plane.icao24}
                    className={`fallback-row ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => selectAircraft(plane.icao24)}
                  >
                    <td className="font-bold text-cyan-400">
                      {plane.callsign.trim() || 'UNKNOWN'}
                    </td>
                    <td>{plane.icao24.toUpperCase()}</td>
                    <td>{plane.originCountry}</td>
                    <td>{alt}</td>
                    <td>{speed}</td>
                    <td>{heading}</td>
                    <td>
                      <span className={`status-pill status-${plane.status}`}>
                        {plane.onGround ? 'GND' : plane.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

