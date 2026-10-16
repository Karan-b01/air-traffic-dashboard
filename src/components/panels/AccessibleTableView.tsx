// src/components/panels/AccessibleTableView.tsx
'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, Check, ChevronDown, ChevronUp, MapPin, Plane, Search, X } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';
import { getAltitudeColor } from '../map/AircraftMap';

type SortKey = 'callsign' | 'icao24' | 'country' | 'altitude' | 'speed' | 'vrate' | 'status';

export default function AccessibleTableView() {
  const isOpen = useAircraftStore((state) => state.tableViewOpen);
  const toggle = useAircraftStore((state) => state.toggleTableView);
  const aircraft = useAircraftStore((state) => state.aircraft);
  const selectedId = useAircraftStore((state) => state.selectedId);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const activeSector = useAircraftStore((state) => state.activeSector);

  const [sortKey, setSortKey] = useState<SortKey>('altitude');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState('');

  const aircraftList = Object.values(aircraft);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortedAircraft = useMemo(() => {
    let list = [...aircraftList];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.callsign.toLowerCase().includes(q) ||
          p.icao24.toLowerCase().includes(q) ||
          p.originCountry.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      switch (sortKey) {
        case 'callsign':
          valA = a.callsign;
          valB = b.callsign;
          break;
        case 'icao24':
          valA = a.icao24;
          valB = b.icao24;
          break;
        case 'country':
          valA = a.originCountry;
          valB = b.originCountry;
          break;
        case 'altitude':
          valA = a.baroAltitude ?? -999;
          valB = b.baroAltitude ?? -999;
          break;
        case 'speed':
          valA = a.velocity ?? -999;
          valB = b.velocity ?? -999;
          break;
        case 'vrate':
          valA = a.verticalRate ?? -999;
          valB = b.verticalRate ?? -999;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    return list;
  }, [aircraftList, sortKey, sortAsc, tableSearch]);

  if (!isOpen) return null;

  return (
    <div className="accessible-table-overlay radar-glass-panel" role="region" aria-label="Accessible Airspace Table View">
      <span className="panel-corner corner-tl" aria-hidden="true" />
      <span className="panel-corner corner-tr" aria-hidden="true" />
      <span className="panel-corner corner-bl" aria-hidden="true" />
      <span className="panel-corner corner-br" aria-hidden="true" />

      {/* Table Header Controls */}
      <div className="table-view-head">
        <div className="table-view-title-group">
          <h2>ACCESSIBLE AIRSPACE TELEMETRY VIEW</h2>
          <span className="font-mono text-xs text-slate-400">
            {activeSector.name} · {sortedAircraft.length} of {aircraftList.length} contacts
          </span>
        </div>

        <div className="table-view-actions">
          <div className="table-search-box">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Filter table rows..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="table-search-input font-mono"
            />
          </div>

          <button
            type="button"
            className="table-view-close-btn"
            onClick={toggle}
            aria-label="Return to Map view"
          >
            <X size={16} /> RETURN TO RADAR
          </button>
        </div>
      </div>

      {/* Semantic Table */}
      <div className="table-scroll-container">
        <table className="accessible-telemetry-table font-mono" aria-label="Active aircraft list">
          <thead>
            <tr>
              <th onClick={() => handleSort('callsign')}>
                <div className="th-content">CALLSIGN <ArrowUpDown size={11} /></div>
              </th>
              <th onClick={() => handleSort('icao24')}>
                <div className="th-content">ICAO24 <ArrowUpDown size={11} /></div>
              </th>
              <th onClick={() => handleSort('country')}>
                <div className="th-content">COUNTRY <ArrowUpDown size={11} /></div>
              </th>
              <th onClick={() => handleSort('altitude')}>
                <div className="th-content">ALTITUDE (FL / M) <ArrowUpDown size={11} /></div>
              </th>
              <th onClick={() => handleSort('speed')}>
                <div className="th-content">SPEED (KM/H) <ArrowUpDown size={11} /></div>
              </th>
              <th onClick={() => handleSort('vrate')}>
                <div className="th-content">VERT RATE (M/S) <ArrowUpDown size={11} /></div>
              </th>
              <th onClick={() => handleSort('status')}>
                <div className="th-content">STATUS <ArrowUpDown size={11} /></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAircraft.map((plane) => {
              const isSelected = plane.icao24 === selectedId;
              const altColor = getAltitudeColor(plane.baroAltitude, plane.onGround, plane.isEmergency);
              const flStr = plane.baroAltitude
                ? `FL${Math.round((plane.baroAltitude * 3.28084) / 100)} (${Math.round(plane.baroAltitude).toLocaleString()}m)`
                : 'SURFACE';

              return (
                <tr
                  key={plane.icao24}
                  className={`table-data-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    selectAircraft(plane.icao24);
                    toggle();
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      selectAircraft(plane.icao24);
                      toggle();
                    }
                  }}
                >
                  <td className="font-bold text-cyan-400">
                    <span className="callsign-cell">
                      <span className="dot" style={{ backgroundColor: altColor }} />
                      {plane.callsign.trim() || 'UNLISTED'}
                    </span>
                  </td>
                  <td>{plane.icao24.toUpperCase()}</td>
                  <td>{plane.originCountry || 'International'}</td>
                  <td>{flStr}</td>
                  <td>{plane.velocity != null ? `${Math.round(plane.velocity * 3.6)} km/h` : '—'}</td>
                  <td>
                    {plane.verticalRate != null
                      ? `${plane.verticalRate > 0 ? '+' : ''}${plane.verticalRate.toFixed(1)} m/s`
                      : 'LEVEL'}
                  </td>
                  <td>
                    <span className={`status-tag status-${plane.status}`}>
                      {plane.onGround ? 'GND' : plane.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

