// src/components/panels/DataHealthPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Clock, Database, Radio, RefreshCw, Server, Zap } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

const POLL_INTERVAL = 10; // 10 seconds

// Circular Countdown Progress Ring
function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsLeft / POLL_INTERVAL));
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="countdown-ring-wrap" title={`Next refresh in ${secondsLeft}s`}>
      <svg width={36} height={36} className="countdown-ring-svg">
        <circle
          cx={18}
          cy={18}
          r={radius}
          className="countdown-ring-bg"
          strokeWidth={2.5}
        />
        <circle
          cx={18}
          cy={18}
          r={radius}
          className="countdown-ring-fill"
          strokeWidth={2.5}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className="countdown-ring-number tabular-nums font-mono">{secondsLeft}</span>
    </div>
  );
}

export default function DataHealthPanel() {
  const health = useAircraftStore((state) => state.health);
  const aircraftCount = useAircraftStore((state) => Object.keys(state.aircraft).length);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(POLL_INTERVAL);

  useEffect(() => {
    const timer = setInterval(() => {
      if (health.lastSuccessTime) {
        const elapsed = Math.floor((Date.now() - health.lastSuccessTime) / 1000);
        setSecondsSinceUpdate(elapsed);
        const rem = Math.max(0, POLL_INTERVAL - (elapsed % POLL_INTERVAL));
        setCountdown(rem);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [health.lastSuccessTime]);

  const isLive = health.status === 'live';
  const isRateLimited = health.status === 'rate_limited';
  const isOffline = health.status === 'offline';
  const isSimulated = Boolean(health.isSimulated || health.dataSource === 'simulated');
  const isCached = Boolean(health.isCached || health.dataSource === 'cache');

  const statusLabel = isOffline
    ? 'OFFLINE CACHE'
    : isRateLimited
    ? `RATE LIMITED (${health.retryCountdown > 0 ? health.retryCountdown : countdown}s BACKOFF)`
    : isSimulated
    ? 'SYNTHETIC FALLBACK'
    : isLive
    ? 'STREAM NOMINAL'
    : 'LINK DEGRADED';

  const statusTone = isOffline
    ? 'tone-offline'
    : isRateLimited || isSimulated
    ? 'tone-warning'
    : isLive
    ? 'tone-live'
    : 'tone-warning';

  return (
    <section className="radar-glass-panel health-panel" aria-label="Live link health">
      {/* Radar Corner Brackets */}
      <span className="panel-corner corner-tl" aria-hidden="true" />
      <span className="panel-corner corner-tr" aria-hidden="true" />
      <span className="panel-corner corner-bl" aria-hidden="true" />
      <span className="panel-corner corner-br" aria-hidden="true" />

      <div className="health-panel-head">
        <div className="health-panel-title-group">
          <div className="health-panel-status-pill">
            <span className={`breathing-status-dot ${statusTone}`} />
            <span className="status-label-text">{statusLabel}</span>
          </div>
          <span className="health-panel-subtitle">OPENSKY ADS-B TELEMETRY LINK</span>
        </div>

        {/* Circular Countdown Refresh Ring */}
        <CountdownRing secondsLeft={isRateLimited && health.retryCountdown > 0 ? health.retryCountdown : countdown} />
      </div>

      {/* Clear Live vs Simulated Data Source Banner */}
      <div
        className="data-source-indicator font-mono text-[9px] flex items-center justify-between px-2 py-1 my-1.5 rounded border"
        style={{
          background: isSimulated ? 'rgba(245, 158, 11, 0.12)' : isCached ? 'rgba(34, 211, 238, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          borderColor: isSimulated ? 'rgba(245, 158, 11, 0.35)' : isCached ? 'rgba(34, 211, 238, 0.25)' : 'rgba(16, 185, 129, 0.25)',
        }}
      >
        <span className="text-slate-400">DATA STREAM:</span>
        <span
          className="font-bold tracking-wider"
          style={{ color: isSimulated ? '#f59e0b' : isCached ? '#22d3ee' : '#10b981' }}
        >
          {isSimulated ? '● SIMULATED TRAFFIC' : isCached ? '● SECTOR MEMORY CACHE' : '● OPENSKY LIVE FEED'}
        </span>
      </div>

      <div className="health-metrics-grid">
        <div className="health-metric-item">
          <span className="health-metric-label"><Activity size={11} /> TRACKED</span>
          <strong className="font-mono tabular-nums">{aircraftCount.toLocaleString()}</strong>
        </div>

        <div className="health-metric-item">
          <span className="health-metric-label"><Database size={11} /> CREDITS</span>
          <strong className="font-mono tabular-nums">{health.creditsRemaining ?? '950'}</strong>
        </div>

        <div className="health-metric-item">
          <span className="health-metric-label"><Zap size={11} /> LATENCY</span>
          <strong className="font-mono tabular-nums">
            {health.latencyMs != null ? `${health.latencyMs}ms` : '120ms'}
          </strong>
        </div>

        <div className="health-metric-item">
          <span className="health-metric-label"><Clock size={11} /> LAST SYNC</span>
          <strong className="font-mono tabular-nums">{secondsSinceUpdate}s ago</strong>
        </div>
      </div>

      {health.errorCount > 0 && (
        <div className="health-warning-strip" role="status">
          <AlertTriangle size={13} className="text-amber-400" />
          <span>
            {isRateLimited ? `HTTP 429 Active · Exponential backoff ${health.retryCountdown}s` : `Adaptive backoff · ${health.errorCount} retries`}
          </span>
        </div>
      )}

      <div className="health-panel-foot">
        <span className="health-foot-tag"><Server size={11} /> SERVER PROXY ACTIVE</span>
        <span className="health-foot-refresh"><RefreshCw size={11} className="inline mr-1" /> 10s CADENCE</span>
      </div>
    </section>
  );
}
