// src/components/ui/StateBanners.tsx
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Clock, Maximize2, Radio, WifiOff } from 'lucide-react';
import { useAircraftStore, SECTORS } from '../../lib/state/useAircraftStore';

export function StateBanners() {
  const health = useAircraftStore((state) => state.health);
  const chaos = useAircraftStore((state) => state.chaos);
  const setSector = useAircraftStore((state) => state.setSector);
  const triggerMaydayAlert = useAircraftStore((state) => state.triggerMaydayAlert);

  const [countdown, setCountdown] = useState(10);

  // Rate limit draining countdown
  useEffect(() => {
    if (health.status !== 'rate_limited' && !chaos.forceRateLimit) return;
    setCountdown(10);

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 10));
    }, 1000);

    return () => clearInterval(timer);
  }, [health.status, chaos.forceRateLimit]);

  // "mayday" Keyboard Easter Egg listener
  useEffect(() => {
    let keyBuffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      keyBuffer += e.key.toLowerCase();
      if (keyBuffer.length > 10) keyBuffer = keyBuffer.slice(-10);

      if (keyBuffer.endsWith('mayday')) {
        keyBuffer = '';
        triggerMaydayAlert();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerMaydayAlert]);

  // Dynamic Browser Favicon based on health status
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const isEmergency = chaos.forceEmergencySquawk;
    const isRateLimited = health.status === 'rate_limited' || chaos.forceRateLimit;
    const isOffline = health.status === 'offline' || chaos.forceOffline;

    const color = isEmergency
      ? '#ef4444'
      : isRateLimited
      ? '#f59e0b'
      : isOffline
      ? '#64748b'
      : '#22d3ee';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}" stroke="#070b14" stroke-width="3"/></svg>`;
    const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;

    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.head.appendChild(link);
    }
    link.href = dataUri;
  }, [health.status, chaos.forceEmergencySquawk, chaos.forceRateLimit, chaos.forceOffline]);

  const isRateLimited = health.status === 'rate_limited' || chaos.forceRateLimit;
  const isOffline = health.status === 'offline' || chaos.forceOffline;

  return (
    <>
      {/* 429 Rate Limit Banner */}
      {isRateLimited && (
        <div className="state-banner-rate-limit" role="alert">
          <div className="banner-content font-mono">
            <span className="banner-icon-pulse"><Clock size={15} /></span>
            <span>OPENSKY 429 RATE LIMIT EXCEEDED · PAUSED ON CACHE</span>
            <span className="banner-countdown">RESUMING IN {countdown}S</span>
          </div>
        </div>
      )}

      {/* Offline Air-Gap Mode Banner */}
      {isOffline && (
        <div className="state-banner-offline" role="alert">
          <div className="banner-content font-mono">
            <WifiOff size={15} className="text-amber-400" />
            <span>OFFLINE AIRSPACE LINK · OPERATING ON PERSISTENT CACHE</span>
          </div>
        </div>
      )}
    </>
  );
}

// Empty Region / Quiet Skies Overlay
export function EmptyRegionNotice() {
  const aircraft = useAircraftStore((state) => state.aircraft);
  const activeSector = useAircraftStore((state) => state.activeSector);
  const setSector = useAircraftStore((state) => state.setSector);
  const resetFilter = useAircraftStore((state) => state.resetFilter);
  const filters = useAircraftStore((state) => state.filters);

  const hasAnyPlanes = Object.keys(aircraft).length > 0;
  if (hasAnyPlanes) return null;

  return (
    <div className="empty-region-overlay radar-glass-panel">
      <div className="empty-radar-scope">
        <span className="empty-radar-ping" />
        <Radio size={28} className="text-cyan-400 animate-pulse" />
      </div>

      <h3 className="empty-region-title">QUIET SKIES IN THIS SECTOR</h3>
      <p className="empty-region-desc">
        No aircraft transponders currently broadcasting within the coordinates of {activeSector.name}.
      </p>

      <div className="empty-region-actions">
        <button
          type="button"
          className="widen-sector-btn"
          onClick={() => setSector('india-all')}
        >
          <Maximize2 size={14} /> WIDEN TO ALL INDIA AIRSPACE
        </button>

        {(filters.searchQuery || filters.minAltitude > 0 || filters.airborneOnly) && (
          <button
            type="button"
            className="clear-filters-btn"
            onClick={resetFilter}
          >
            Clear Active Filters
          </button>
        )}
      </div>
    </div>
  );
}

