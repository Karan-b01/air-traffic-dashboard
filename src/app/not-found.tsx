// src/app/not-found.tsx
import Link from 'next/link';
import { ArrowLeft, Compass, Radio, ShieldAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="error-page-shell">
      {/* Background Radar Scope */}
      <div className="error-radar-scope" aria-hidden="true">
        <div className="radar-circle rc-1" />
        <div className="radar-circle rc-2" />
        <div className="radar-circle rc-3" />
        <div className="radar-crosshair-x" />
        <div className="radar-crosshair-y" />
        {/* Lone Blip drifting away */}
        <div className="drifting-blip">
          <span className="blip-beacon" />
          <span className="blip-tag font-mono">FL404 // LOST CONTACT</span>
        </div>
      </div>

      <div className="error-card radar-glass-panel">
        <span className="panel-corner corner-tl" aria-hidden="true" />
        <span className="panel-corner corner-tr" aria-hidden="true" />
        <span className="panel-corner corner-bl" aria-hidden="true" />
        <span className="panel-corner corner-br" aria-hidden="true" />

        <div className="error-badge">
          <Radio size={14} className="text-cyan-400 animate-pulse" />
          <span>TRANSPONDER LOSS</span>
        </div>

        <h1 className="error-title font-mono">404 // OFF THE RADAR</h1>
        
        <p className="error-desc">
          This flight plan departed controlled airspace. The coordinates you requested do not correlate
          with any active sector vectors.
        </p>

        <div className="error-telemetry font-mono">
          <div><span>STATUS:</span> <b className="text-rose-400">CONTACT LOST</b></div>
          <div><span>SQUAWK:</span> <b>0404</b></div>
          <div><span>SECTOR:</span> <b>UNKNOWN / UNCHARTED</b></div>
        </div>

        <div className="error-actions">
          <Link href="/" className="return-base-btn">
            <ArrowLeft size={16} />
            <span>RETURN TO AIRSPACE COMMAND</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

