// src/components/panels/AircraftPanel.tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Check,
  Compass,
  Copy,
  Crosshair,
  Globe2,
  Navigation,
  Plane,
  Radio,
  X,
} from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';
import { soundFx } from '../../lib/audio/AudioSynthesizer';

// Odometer animated number ticker
function OdometerNumber({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value == null) return <span>—</span>;
  return (
    <span className="odometer-display tabular-nums font-mono">
      {Math.round(value).toLocaleString()}
      {suffix && <span className="odometer-suffix font-sans text-xs ml-1 text-slate-400">{suffix}</span>}
    </span>
  );
}

// Altitude history sparkline SVG
function AltitudeSparkline({ history }: { history: Array<{ altitude: number | null }> }) {
  const altitudes = history.map((h) => h.altitude).filter((a): a is number => a != null);
  if (altitudes.length < 2) {
    return <div className="sparkline-empty">Awaiting altitude vector history</div>;
  }

  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const range = max - min || 1;
  const width = 240;
  const height = 44;

  const points = altitudes
    .map((val, idx) => {
      const x = (idx / (altitudes.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="sparkline-wrap">
      <div className="sparkline-labels">
        <span>ALTITUDE PROFILE</span>
        <span className="font-mono text-cyan-400">Δ {Math.round(max - min)}m</span>
      </div>
      <svg width={width} height={height} className="sparkline-svg">
        <defs>
          <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

export default function AircraftPanel() {
  const selectedId = useAircraftStore((state) => state.selectedId);
  const selectedPlane = useAircraftStore((state) =>
    selectedId ? state.aircraft[selectedId] ?? null : null
  );
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const chaseCameraId = useAircraftStore((state) => state.chaseCameraId);
  const setChaseCamera = useAircraftStore((state) => state.setChaseCamera);

  const [copied, setCopied] = useState(false);

  const handleCopyIcao = () => {
    if (!selectedPlane) return;
    navigator.clipboard.writeText(selectedPlane.icao24.toUpperCase());
    soundFx.playClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isChasing = chaseCameraId === selectedPlane?.icao24;
  const handleToggleChase = () => {
    if (!selectedPlane) return;
    soundFx.playTargetLock();
    setChaseCamera(isChasing ? null : selectedPlane.icao24);
  };

  return (
    <AnimatePresence>
      {selectedPlane && (
        <motion.aside
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className="radar-glass-panel aircraft-detail-panel"
          aria-label="Selected aircraft telemetry panel"
        >
          {/* Radar Corner Brackets */}
          <span className="panel-corner corner-tl" aria-hidden="true" />
          <span className="panel-corner corner-tr" aria-hidden="true" />
          <span className="panel-corner corner-bl" aria-hidden="true" />
          <span className="panel-corner corner-br" aria-hidden="true" />

          {/* Panel Header */}
          <div className="aircraft-detail-head">
            <div className="aircraft-detail-heading-copy">
              <span className="aircraft-detail-kicker">
                <Plane size={12} className="text-cyan-400" />
                <span>TARGET ACQUIRED · TRANSPONDER</span>
              </span>
              <h2>{selectedPlane.callsign.trim() || 'UNIDENTIFIED'}</h2>
              <div className="aircraft-detail-subhead">
                <span className="aircraft-detail-icao font-mono">
                  ICAO: {selectedPlane.icao24.toUpperCase()}
                </span>
                <button
                  type="button"
                  className="copy-icao-btn"
                  onClick={handleCopyIcao}
                  title="Copy ICAO to clipboard"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div className="detail-head-actions">
              <button
                type="button"
                className={`chase-cam-btn ${isChasing ? 'is-active' : ''}`}
                onClick={handleToggleChase}
                title={isChasing ? 'Disengage chase camera' : 'Engage chase camera'}
              >
                <Crosshair size={15} />
              </button>

              <button
                type="button"
                className="icon-button aircraft-detail-close"
                onClick={() => {
                  soundFx.playClick();
                  selectAircraft(null);
                  if (isChasing) setChaseCamera(null);
                }}
                aria-label="Close aircraft details"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Key Telemetry Metrics Grid (Odometer numbers) */}
          <div className="aircraft-detail-grid">
            <div className="aircraft-detail-metric">
              <span className="metric-tag"><Activity size={12} /> BARO ALTITUDE</span>
              <strong>
                <OdometerNumber value={selectedPlane.baroAltitude} suffix="m" />
              </strong>
              <span className="metric-flight-level font-mono text-cyan-400">
                {selectedPlane.baroAltitude != null
                  ? `FL${Math.round((selectedPlane.baroAltitude * 3.28084) / 100)}`
                  : 'GND'}
              </span>
            </div>

            <div className="aircraft-detail-metric">
              <span className="metric-tag"><Plane size={12} /> GROUND SPEED</span>
              <strong>
                <OdometerNumber
                  value={selectedPlane.velocity != null ? selectedPlane.velocity * 3.6 : null}
                  suffix="km/h"
                />
              </strong>
              <span className="metric-knots font-mono text-slate-400">
                {selectedPlane.velocity != null
                  ? `${Math.round(selectedPlane.velocity * 1.94384)} kts`
                  : '—'}
              </span>
            </div>

            <div className="aircraft-detail-metric">
              <span className="metric-tag"><Compass size={12} /> TRUE TRACK</span>
              <div className="heading-metric-row">
                <strong>
                  <OdometerNumber value={selectedPlane.heading} suffix="°" />
                </strong>
                {/* Rotating Compass Needle */}
                <div
                  className="compass-needle-widget"
                  style={{
                    transform: `rotate(${selectedPlane.heading || 0}deg)`,
                  }}
                  title={`Heading ${Math.round(selectedPlane.heading || 0)}°`}
                >
                  <Navigation size={14} className="text-cyan-400" />
                </div>
              </div>
            </div>

            <div className="aircraft-detail-metric">
              <span className="metric-tag"><ArrowUpRight size={12} /> VERTICAL RATE</span>
              <strong className={selectedPlane.verticalRate && selectedPlane.verticalRate > 0 ? 'text-emerald-400' : selectedPlane.verticalRate && selectedPlane.verticalRate < 0 ? 'text-amber-400' : ''}>
                {selectedPlane.verticalRate == null
                  ? 'LEVEL'
                  : `${selectedPlane.verticalRate > 0 ? '+' : ''}${selectedPlane.verticalRate.toFixed(1)} m/s`}
              </strong>
              <span className="metric-fpm font-mono text-slate-400">
                {selectedPlane.verticalRate != null
                  ? `${Math.round(selectedPlane.verticalRate * 196.85)} fpm`
                  : '—'}
              </span>
            </div>
          </div>

          {/* Altitude Sparkline */}
          <div className="detail-sparkline-card">
            <AltitudeSparkline history={selectedPlane.history || []} />
          </div>

          {/* Origin & Geographic Position */}
          <div className="aircraft-detail-location">
            <span className="location-icon"><Globe2 size={15} /></span>
            <div className="location-info">
              <span className="location-label">ORIGIN REGISTRATION</span>
              <strong>{selectedPlane.originCountry || 'International Airspace'}</strong>
            </div>
            <div className="location-coordinate font-mono">
              <span>{selectedPlane.latitude.toFixed(4)}° N</span>
              <span>{selectedPlane.longitude.toFixed(4)}° E</span>
            </div>
          </div>

          {/* Transponder & Squawk Status Footnote */}
          <div className="aircraft-detail-foot">
            <div className="squawk-badge">
              <Radio size={12} />
              <span>SQUAWK: <b>{selectedPlane.squawk || 'AUTO'}</b></span>
            </div>
            <span className={`contact-status-pill status-${selectedPlane.status}`}>
              <span className="status-dot" />
              {selectedPlane.onGround ? 'ON GROUND' : selectedPlane.status.toUpperCase()}
            </span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
