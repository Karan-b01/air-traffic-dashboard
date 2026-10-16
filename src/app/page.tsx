// src/app/page.tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Compass,
  Globe2,
  Layers,
  MapPin,
  Moon,
  Plane,
  Radio,
  Signal,
  Sun,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import AircraftMap from '../components/map/AircraftMap';
import AltitudeCorridor from '../components/map/AltitudeCorridor';
import AircraftPanel from '../components/panels/AircraftPanel';
import DataHealthPanel from '../components/panels/DataHealthPanel';
import EventFeedPanel from '../components/panels/EventFeedPanel';
import FilterBar from '../components/panels/FilterBar';
import ChaosPanel from '../components/panels/ChaosPanel';
import ReplayBar from '../components/panels/ReplayBar';
import CommandPalette from '../components/panels/CommandPalette';
import FpsOverlay from '../components/panels/FpsOverlay';
import LandingPage from '../components/landing/LandingPage';
import BootSequence from '../components/boot/BootSequence';
import { StateBanners, EmptyRegionNotice } from '../components/ui/StateBanners';
import { usePolling } from '../hooks/usePolling';
import { useAircraftStore, SECTORS } from '../lib/state/useAircraftStore';
import { soundFx } from '../lib/audio/AudioSynthesizer';

type AppStage = 'landing' | 'boot' | 'dashboard';

export default function Home() {
  const [appStage, setAppStage] = useState<AppStage>('landing');

  return (
    <div className="app-root-shell">
      <AnimatePresence mode="wait">
        {appStage === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            <LandingPage onEnterDashboard={() => setAppStage('boot')} />
          </motion.div>
        )}

        {appStage === 'boot' && (
          <motion.div
            key="boot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            <BootSequence onBootComplete={() => setAppStage('dashboard')} />
          </motion.div>
        )}

        {appStage === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            <DashboardConsole onReturnToLanding={() => setAppStage('landing')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardConsole({ onReturnToLanding }: { onReturnToLanding: () => void }) {
  // Start ADS-B polling with 10s cadence
  usePolling(10000);

  const aircraft = useAircraftStore((state) => state.aircraft);
  const health = useAircraftStore((state) => state.health);
  const selectedId = useAircraftStore((state) => state.selectedId);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const activeSector = useAircraftStore((state) => state.activeSector);
  const setSector = useAircraftStore((state) => state.setSector);
  const viewMode = useAircraftStore((state) => state.viewMode);
  const setViewMode = useAircraftStore((state) => state.setViewMode);
  const themeMode = useAircraftStore((state) => state.themeMode);
  const setThemeMode = useAircraftStore((state) => state.setThemeMode);
  const soundEnabled = useAircraftStore((state) => state.soundEnabled);
  const toggleSound = useAircraftStore((state) => state.toggleSound);
  const toggleAltitudeCorridor = useAircraftStore((state) => state.toggleAltitudeCorridor);
  const altitudeCorridorOpen = useAircraftStore((state) => state.altitudeCorridorOpen);
  const radarSweepEnabled = useAircraftStore((state) => state.radarSweepEnabled);
  const toggleRadarSweep = useAircraftStore((state) => state.toggleRadarSweep);
  const densityHeatmapEnabled = useAircraftStore((state) => state.densityHeatmapEnabled);
  const toggleDensityHeatmap = useAircraftStore((state) => state.toggleDensityHeatmap);

  const aircraftList = Object.values(aircraft);
  const airborneCount = aircraftList.filter((plane) => !plane.onGround).length;
  const groundCount = aircraftList.length - airborneCount;
  const altitudeValues = aircraftList
    .map((plane) => plane.baroAltitude)
    .filter((alt): alt is number => alt != null);
  const averageAltitude = altitudeValues.length
    ? Math.round(altitudeValues.reduce((sum, val) => sum + val, 0) / altitudeValues.length)
    : null;

  const recentAircraft = aircraftList
    .slice()
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 4);

  const isLive = health.status === 'live';
  const isReplaying = useAircraftStore((state) => state.replay.isReplaying);

  return (
    <main className={`dashboard-shell ${themeMode === 'day' ? 'theme-day' : ''} ${isReplaying ? 'is-replay-mode' : ''}`}>
      {/* 2D / 3D WebGL Radar Map */}
      <AircraftMap />
      <div className="map-shade" aria-hidden="true" />

      {/* Global State Banners (429 countdown, offline notice) */}
      <StateBanners />

      {/* Empty Region Notice */}
      <EmptyRegionNotice />

      {/* Tactical Topbar */}
      <header className="topbar radar-glass-panel">
        <div className="topbar-left">
          <button
            type="button"
            className="brand"
            onClick={onReturnToLanding}
            title="Return to 3D Globe Landing Page"
          >
            <span className="brand-mark"><Plane size={18} strokeWidth={2.4} /></span>
            <span className="brand-copy">
              <span className="brand-name">AIR<span>SPACE</span></span>
              <span className="brand-byline">NIGHT OPS · CONTROL ROOM</span>
            </span>
          </button>

          {/* Sector Selector Dropdown */}
          <div className="topbar-sector-selector">
            <MapPin size={14} className="text-cyan-400" />
            <select
              className="sector-select-input font-mono"
              value={activeSector.id}
              onChange={(e) => setSector(e.target.value)}
              aria-label="Select Airspace Sector"
            >
              {SECTORS.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name} ({s.subtitle.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Switcher: 2D / 3D / Globe */}
        <div className="view-switcher-group font-mono">
          <button
            type="button"
            className={`view-switch-btn ${viewMode === '2d' ? 'is-active' : ''}`}
            onClick={() => setViewMode('2d')}
            title="2D Flat Orthographic View"
          >
            <Layers size={13} />
            <span>2D</span>
          </button>
          <button
            type="button"
            className={`view-switch-btn ${viewMode === '3d' ? 'is-active' : ''}`}
            onClick={() => setViewMode('3d')}
            title="3D Tactical Tilt with Altitude Stems"
          >
            <Compass size={13} />
            <span>3D TILT</span>
          </button>
          <button
            type="button"
            className={`view-switch-btn ${viewMode === 'globe' ? 'is-active' : ''}`}
            onClick={() => setViewMode('globe')}
            title="Orbital Wide Perspective"
          >
            <Globe2 size={13} />
            <span>GLOBE</span>
          </button>
        </div>

        {/* Action Controls & Toggles */}
        <div className="topbar-actions">
          {/* Command Palette */}
          <CommandPalette />

          {/* Altitude Corridor Profile Toggle */}
          <button
            type="button"
            className={`tool-icon-btn ${altitudeCorridorOpen ? 'is-active' : ''}`}
            onClick={toggleAltitudeCorridor}
            title="Toggle Side Altitude Profile Corridor"
          >
            <Activity size={15} />
            <span className="hidden md:inline text-xs font-mono ml-1">CORRIDOR</span>
          </button>

          {/* Radar Sweep Toggle */}
          <button
            type="button"
            className={`tool-icon-btn ${radarSweepEnabled ? 'is-active' : ''}`}
            onClick={toggleRadarSweep}
            title="Toggle Radar Sweep Beam"
          >
            <Radio size={15} />
          </button>

          {/* Audio Synthesizer Toggle */}
          <button
            type="button"
            className={`tool-icon-btn ${soundEnabled ? 'is-active' : ''}`}
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Audio Synthesizer' : 'Unmute Audio Synthesizer'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* Daylight Ops / Night Ops Theme Toggle */}
          <button
            type="button"
            className="tool-icon-btn"
            onClick={() => setThemeMode(themeMode === 'night' ? 'day' : 'night')}
            title={themeMode === 'night' ? 'Switch to Daylight Ops' : 'Switch to Night Ops'}
          >
            {themeMode === 'night' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Status & Clock */}
          <div className="topbar-status">
            <span className={`connection-pill ${isLive ? 'is-live' : 'is-warning'}`}>
              <span className="connection-dot" />
              {isLive ? 'LIVE FEED' : 'BACKOFF'}
            </span>
            <span className="topbar-clock font-mono tabular-nums">
              {health.lastSuccessTime
                ? new Date(health.lastSuccessTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })
                : 'SYNCING'}
              <span>UTC</span>
            </span>
          </div>
        </div>
      </header>

      {/* Filter Bar with Sliders & Live Count */}
      <FilterBar />

      {/* Sector Coordinate Rule */}
      <div className="map-label font-mono" aria-hidden="true">
        <span className="map-label-rule" />
        <span>{activeSector.name.toUpperCase()}</span>
        <span className="map-label-coordinate">
          {activeSector.center[1].toFixed(2)}° N / {activeSector.center[0].toFixed(2)}° E
        </span>
      </div>

      {/* Dashboard Overlays & Sidebars */}
      <div className={`dashboard-overlay ${selectedId ? 'has-selection' : ''}`} id="main">
        {/* Left Sector Overview Panel */}
        <aside className="overview-panel radar-glass-panel" aria-label="Airspace overview">
          <span className="panel-corner corner-tl" aria-hidden="true" />
          <span className="panel-corner corner-tr" aria-hidden="true" />
          <span className="panel-corner corner-bl" aria-hidden="true" />
          <span className="panel-corner corner-br" aria-hidden="true" />

          <div className="panel-kicker">
            <span /> SECTOR TELEMETRY
          </div>

          <div className="overview-heading">
            <div>
              <h1>{activeSector.name}</h1>
              <p>{activeSector.subtitle}</p>
            </div>
            <span className="overview-icon"><Radio size={18} /></span>
          </div>

          <div className="traffic-total">
            <span className="traffic-total-value tabular-nums font-mono">
              {aircraftList.length}
            </span>
            <span className="traffic-total-label">active transponders</span>
            <span className="traffic-total-trend">
              <Signal size={13} /> 60 FPS vector dead reckoning
            </span>
          </div>

          <div className="overview-stats">
            <div className="overview-stat">
              <span className="stat-symbol stat-symbol-cyan"><Wind size={15} /></span>
              <span className="stat-label">Airborne</span>
              <strong className="font-mono tabular-nums">{airborneCount}</strong>
            </div>
            <div className="overview-stat">
              <span className="stat-symbol stat-symbol-amber"><Plane size={15} /></span>
              <span className="stat-label">On ground</span>
              <strong className="font-mono tabular-nums">{groundCount}</strong>
            </div>
            <div className="overview-stat overview-stat-wide">
              <span className="stat-symbol stat-symbol-violet"><Activity size={15} /></span>
              <span className="stat-label">Mean altitude</span>
              <strong className="font-mono tabular-nums">
                {averageAltitude == null ? '—' : `${averageAltitude.toLocaleString()} m (FL${Math.round((averageAltitude * 3.28084) / 100)})`}
              </strong>
            </div>
          </div>

          <div className="panel-section-heading">
            <span>SECTOR RADAR CONTACTS</span>
            <span className="section-count font-mono">
              {recentAircraft.length.toString().padStart(2, '0')}
            </span>
          </div>

          {recentAircraft.length ? (
            <div className="contact-list">
              {recentAircraft.map((plane) => (
                <button
                  type="button"
                  className={`contact-row ${selectedId === plane.icao24 ? 'is-active' : ''}`}
                  key={plane.icao24}
                  onClick={() => selectAircraft(plane.icao24)}
                >
                  <span className="contact-plane-icon"><Plane size={14} /></span>
                  <span className="contact-copy">
                    <span className="contact-callsign font-mono">
                      {plane.callsign.trim() || plane.icao24.toUpperCase()}
                    </span>
                    <span className="contact-origin">{plane.originCountry}</span>
                  </span>
                  <span className="contact-altitude font-mono">
                    {plane.baroAltitude == null
                      ? 'GND'
                      : `FL${Math.round((plane.baroAltitude * 3.28084) / 100)}`}
                    <ArrowUpRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-contacts font-mono">
              <span className="empty-pulse" />
              <span>Scanning sector frequencies</span>
            </div>
          )}

          <div className="overview-footer font-mono">
            <span>DATA SOURCE</span>
            <span>OPENSKY ADS-B <span className="footer-live-dot" /></span>
          </div>
        </aside>

        {/* Selected Aircraft Telemetry Panel (Springs in from right) */}
        <AircraftPanel />

        {/* Data Link Health Panel with Circular Countdown Ring */}
        <DataHealthPanel />
      </div>

      {/* Side Profile Elevation Corridor */}
      <AltitudeCorridor />

      {/* Floating ATC Event Feed */}
      <EventFeedPanel />

      {/* Bottom Command Dock */}
      <div className="dashboard-bottom-dock">
        {/* Chaos Engineering Console Drawer */}
        <ChaosPanel />

        {/* Historic Replay Timeline Bar */}
        <ReplayBar />

        {/* Live Debug FPS Overlay */}
        <FpsOverlay />
      </div>

      {/* Footer */}
      <footer className="dashboard-footer font-mono">
        <span>AIRSPACE NIGHT OPERATIONS · PRECISION ADS-B VECTOR ENGINE</span>
        <button type="button" onClick={onReturnToLanding} className="footer-switch-view">
          Switch to 3D Globe Hero
        </button>
      </footer>
    </main>
  );
}
