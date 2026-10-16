// src/app/error.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, ShieldAlert, Terminal } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleRetry = () => {
    setIsReconnecting(true);
    setTimeout(() => {
      reset();
    }, 800);
  };

  return (
    <main className="mayday-error-shell">
      {/* Red CRT Scanline & Grain Texture */}
      <div className="mayday-crt-overlay" aria-hidden="true" />
      <div className="mayday-vignette" aria-hidden="true" />

      <div className="mayday-card radar-glass-panel">
        <span className="panel-corner corner-tl" aria-hidden="true" />
        <span className="panel-corner corner-tr" aria-hidden="true" />
        <span className="panel-corner corner-bl" aria-hidden="true" />
        <span className="panel-corner corner-br" aria-hidden="true" />

        <div className="mayday-header">
          <ShieldAlert size={28} className="text-rose-500 animate-pulse" />
          <div className="mayday-transmission-line font-mono">
            <span className="flicker-text">SIGNAL LOST // MAYDAY DECLARATION // SQUAWK 7700</span>
          </div>
        </div>

        <h1 className="mayday-title font-mono">SYSTEM ANOMALY OCCURRED</h1>

        <p className="mayday-desc">
          Telemetry processing encountered a critical runtime exception. The radar kernel has isolated
          the failure to safeguard air traffic operations.
        </p>

        <div className="mayday-diagnostic-box font-mono">
          <div className="diag-head"><Terminal size={12} /> CRASH DIAGNOSTIC TELEMETRY</div>
          <code className="diag-code">
            {error.message || 'Unknown sector telemetry synchronization error.'}
          </code>
          {error.digest && <div className="diag-digest">DIGEST ID: {error.digest}</div>}
        </div>

        <div className="mayday-actions">
          <button
            type="button"
            className="reconnect-btn"
            onClick={handleRetry}
            disabled={isReconnecting}
          >
            {isReconnecting ? (
              <>
                <RefreshCw size={16} className="animate-spin text-cyan-400" />
                <span>ATTEMPTING TELEMETRY RECONNECT...</span>
              </>
            ) : (
              <>
                <RotateCcw size={16} />
                <span>RECONNECT RADAR FEED</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

