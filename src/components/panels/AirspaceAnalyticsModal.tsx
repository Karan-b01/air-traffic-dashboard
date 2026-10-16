// src/components/panels/AirspaceAnalyticsModal.tsx
'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Layers, PieChart, Plane, TrendingUp, Wind, X } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

const AIRLINE_PREFIX_MAP: Record<string, string> = {
  AIC: 'Air India',
  IGO: 'IndiGo',
  SEJ: 'SpiceJet',
  VTI: 'Vistara',
  AKJ: 'Akasa Air',
  UAE: 'Emirates',
  ETD: 'Etihad Airways',
  QTR: 'Qatar Airways',
  SIA: 'Singapore Airlines',
  BAW: 'British Airways',
  DLH: 'Lufthansa',
  AFR: 'Air France',
  KLM: 'KLM',
  QFA: 'Qantas',
  THY: 'Turkish Airlines',
  FDX: 'FedEx Express',
  UPS: 'UPS Airlines',
};

export default function AirspaceAnalyticsModal() {
  const isOpen = useAircraftStore((state) => state.analyticsOpen);
  const toggle = useAircraftStore((state) => state.toggleAnalytics);
  const aircraft = useAircraftStore((state) => state.aircraft);
  const activeSector = useAircraftStore((state) => state.activeSector);
  const densityHeatmapEnabled = useAircraftStore((state) => state.densityHeatmapEnabled);
  const toggleDensityHeatmap = useAircraftStore((state) => state.toggleDensityHeatmap);

  const aircraftList = Object.values(aircraft);
  const totalCount = aircraftList.length;

  // 1. Altitude Bands
  const altitudeBands = useMemo(() => {
    let low = 0;      // < 1500m
    let midLow = 0;   // 1500m - 4500m (FL50 - FL150)
    let mid = 0;      // 4500m - 9000m (FL150 - FL300)
    let high = 0;     // > 9000m (FL300+)
    let ground = 0;

    aircraftList.forEach((p) => {
      if (p.onGround) {
        ground++;
      } else if (p.baroAltitude == null || p.baroAltitude < 1500) {
        low++;
      } else if (p.baroAltitude < 4500) {
        midLow++;
      } else if (p.baroAltitude < 9000) {
        mid++;
      } else {
        high++;
      }
    });

    return [
      { label: 'High Cruise (FL300+)', count: high, color: '#a78bfa' },
      { label: 'Mid Cruise (FL150-300)', count: mid, color: '#22d3ee' },
      { label: 'Initial Climb (FL50-150)', count: midLow, color: '#facc15' },
      { label: 'Terminal / Approach (<FL50)', count: low, color: '#fb923c' },
      { label: 'Airport Surface (GND)', count: ground, color: '#64748b' },
    ];
  }, [aircraftList]);

  // 2. Top Airlines Breakdown
  const topAirlines = useMemo(() => {
    const counts: Record<string, number> = {};

    aircraftList.forEach((p) => {
      const callsign = (p.callsign || '').trim();
      const prefix = callsign.slice(0, 3).toUpperCase();
      const name = AIRLINE_PREFIX_MAP[prefix] || (prefix ? `Operator ${prefix}` : 'General Aviation');
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalCount ? Math.round((count / totalCount) * 100) : 0,
      }));
  }, [aircraftList, totalCount]);

  // 3. Average Speed and Climb Rates
  const stats = useMemo(() => {
    const validSpeeds = aircraftList
      .map((p) => p.velocity)
      .filter((v): v is number => v != null && v > 5);
    const avgSpeed = validSpeeds.length
      ? Math.round((validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length) * 3.6)
      : null;

    const climbing = aircraftList.filter((p) => p.verticalRate && p.verticalRate > 1.5).length;
    const descending = aircraftList.filter((p) => p.verticalRate && p.verticalRate < -1.5).length;
    const level = totalCount - climbing - descending;

    return { avgSpeed, climbing, descending, level };
  }, [aircraftList, totalCount]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="analytics-modal-backdrop" onClick={toggle}>
          <motion.div
            className="analytics-modal radar-glass-panel"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Airspace Analytics Dashboard"
          >
            <span className="panel-corner corner-tl" aria-hidden="true" />
            <span className="panel-corner corner-tr" aria-hidden="true" />
            <span className="panel-corner corner-bl" aria-hidden="true" />
            <span className="panel-corner corner-br" aria-hidden="true" />

            <div className="analytics-head">
              <div className="analytics-title-group">
                <BarChart3 size={18} className="text-cyan-400" />
                <div>
                  <h2>AIRSPACE SECTOR ANALYTICS</h2>
                  <span className="analytics-subtitle font-mono">
                    {activeSector.name.toUpperCase()} · {totalCount} ACTIVE TRANSPONDERS
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="analytics-close-btn"
                onClick={toggle}
                aria-label="Close analytics"
              >
                <X size={16} />
              </button>
            </div>

            <div className="analytics-body-grid">
              {/* Left Column: Altitude Distribution Histogram */}
              <div className="analytics-card">
                <div className="card-head">
                  <span className="card-tag font-mono">
                    <TrendingUp size={12} className="text-cyan-400" /> ALTITUDE STRATIFICATION
                  </span>
                </div>
                <div className="altitude-histogram-list">
                  {altitudeBands.map((band) => {
                    const pct = totalCount ? Math.round((band.count / totalCount) * 100) : 0;
                    return (
                      <div key={band.label} className="histogram-row">
                        <div className="histogram-label-row font-mono">
                          <span>{band.label}</span>
                          <b>{band.count} ({pct}%)</b>
                        </div>
                        <div className="histogram-track">
                          <motion.div
                            className="histogram-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            style={{ backgroundColor: band.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Top Operators */}
              <div className="analytics-card">
                <div className="card-head">
                  <span className="card-tag font-mono">
                    <PieChart size={12} className="text-purple-400" /> TOP AIRLINE OPERATORS
                  </span>
                </div>
                <div className="top-operators-list">
                  {topAirlines.length === 0 ? (
                    <div className="empty-operators font-mono text-slate-500">
                      No active flight callsigns parsed.
                    </div>
                  ) : (
                    topAirlines.map((op, idx) => (
                      <div key={op.name} className="operator-row font-mono">
                        <span className="op-rank text-cyan-400 font-bold">#{idx + 1}</span>
                        <span className="op-name">{op.name}</span>
                        <span className="op-count">{op.count} flights</span>
                        <span className="op-pct font-bold text-slate-300">{op.percent}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics & Density Heatmap Toggle */}
            <div className="analytics-bottom-strip">
              <div className="stat-pill font-mono">
                <span>MEAN AIRSPEED:</span>
                <b>{stats.avgSpeed ? `${stats.avgSpeed} km/h` : '—'}</b>
              </div>
              <div className="stat-pill font-mono">
                <span>VERTICAL PROFILES:</span>
                <b className="text-emerald-400">↑ {stats.climbing}</b>
                <b className="text-amber-400 ml-1">↓ {stats.descending}</b>
                <b className="text-slate-400 ml-1">→ {stats.level}</b>
              </div>

              <button
                type="button"
                className={`density-toggle-pill ${densityHeatmapEnabled ? 'is-active' : ''}`}
                onClick={toggleDensityHeatmap}
              >
                <Layers size={13} />
                <span>TRAFFIC DENSITY HEATMAP: {densityHeatmapEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

