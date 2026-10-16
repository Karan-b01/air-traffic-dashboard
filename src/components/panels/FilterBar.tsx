// src/components/panels/FilterBar.tsx
'use client';

import { useState } from 'react';
import { Filter, RotateCcw, Search, SlidersHorizontal, Wind } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

export default function FilterBar() {
  const [isOpen, setIsOpen] = useState(false);
  const filters = useAircraftStore((state) => state.filters);
  const setFilter = useAircraftStore((state) => state.setFilter);
  const resetFilter = useAircraftStore((state) => state.resetFilter);
  const aircraft = useAircraftStore((state) => state.aircraft);

  const aircraftList = Object.values(aircraft);
  const totalCount = aircraftList.length;

  const filteredCount = aircraftList.filter((plane) => {
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const match =
        plane.callsign.toLowerCase().includes(q) ||
        plane.icao24.toLowerCase().includes(q) ||
        plane.originCountry.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.airborneOnly && plane.onGround) return false;
    const alt = plane.baroAltitude || 0;
    if (alt < filters.minAltitude || alt > filters.maxAltitude) return false;
    const speed = (plane.velocity || 0) * 3.6;
    if (speed < filters.minSpeed) return false;
    return true;
  }).length;

  const isFiltered =
    filters.searchQuery !== '' ||
    filters.minAltitude > 0 ||
    filters.maxAltitude < 15000 ||
    filters.minSpeed > 0 ||
    filters.airborneOnly;

  return (
    <div className="filter-bar-container">
      <div className="filter-bar-strip radar-glass-panel">
        {/* Search Input */}
        <div className="filter-search-wrap">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Filter callsign, ICAO, country..."
            value={filters.searchQuery}
            onChange={(e) => setFilter({ searchQuery: e.target.value })}
          />
        </div>

        {/* Filter Drawer Toggle */}
        <button
          type="button"
          className={`filter-toggle-btn ${isOpen || isFiltered ? 'is-active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <SlidersHorizontal size={14} />
          <span>FILTERS</span>
          {isFiltered && <span className="filter-active-dot" />}
        </button>

        {/* Filter Count Badge */}
        <div className="filter-count-badge font-mono tabular-nums">
          <span className="count-highlight">{filteredCount}</span>
          <span className="count-slash">/</span>
          <span className="count-total">{totalCount}</span>
          <span className="count-label">IN VIEW</span>
        </div>

        {isFiltered && (
          <button
            type="button"
            className="filter-reset-btn"
            onClick={resetFilter}
            title="Reset all filters"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Expanded Slider Controls */}
      {isOpen && (
        <div className="filter-drawer-panel radar-glass-panel animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="panel-corner corner-tl" aria-hidden="true" />
          <span className="panel-corner corner-tr" aria-hidden="true" />
          <span className="panel-corner corner-bl" aria-hidden="true" />
          <span className="panel-corner corner-br" aria-hidden="true" />

          {/* Quick Presets */}
          <div className="filter-presets-row">
            <span className="preset-label">PRESETS:</span>
            <button
              type="button"
              className={`preset-btn ${!isFiltered ? 'is-selected' : ''}`}
              onClick={resetFilter}
            >
              All Aircraft
            </button>
            <button
              type="button"
              className={`preset-btn ${filters.minAltitude === 9000 ? 'is-selected' : ''}`}
              onClick={() => setFilter({ minAltitude: 9000, maxAltitude: 15000, airborneOnly: true })}
            >
              Cruising (FL300+)
            </button>
            <button
              type="button"
              className={`preset-btn ${filters.airborneOnly ? 'is-selected' : ''}`}
              onClick={() => setFilter({ airborneOnly: true })}
            >
              Airborne Only
            </button>
            <button
              type="button"
              className={`preset-btn ${filters.showGroundAircraft ? 'is-selected' : ''}`}
              onClick={() => setFilter({ showGroundAircraft: !filters.showGroundAircraft })}
            >
              Ground Traffic ({filters.showGroundAircraft ? 'ON' : 'OFF'})
            </button>
          </div>

          <div className="filter-sliders-grid">
            {/* Minimum Altitude Slider */}
            <div className="filter-slider-item">
              <div className="slider-header">
                <span>MIN ALTITUDE</span>
                <span className="slider-val-bubble font-mono">
                  {filters.minAltitude === 0
                    ? '0m (GND)'
                    : `FL${Math.round((filters.minAltitude * 3.28084) / 100)} (${Math.round(filters.minAltitude)}m)`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12000}
                step={500}
                value={filters.minAltitude}
                onChange={(e) => setFilter({ minAltitude: parseInt(e.target.value, 10) })}
                className="filter-range-slider"
              />
            </div>

            {/* Minimum Speed Slider */}
            <div className="filter-slider-item">
              <div className="slider-header">
                <span>MIN GROUND SPEED</span>
                <span className="slider-val-bubble font-mono">
                  {filters.minSpeed === 0 ? 'Any Speed' : `${filters.minSpeed} km/h`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={900}
                step={50}
                value={filters.minSpeed}
                onChange={(e) => setFilter({ minSpeed: parseInt(e.target.value, 10) })}
                className="filter-range-slider"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

