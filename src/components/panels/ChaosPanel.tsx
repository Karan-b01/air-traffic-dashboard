// src/components/panels/ChaosPanel.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, Flame, ShieldAlert, Sparkles, Terminal, WifiOff, X } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

export default function ChaosPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const chaos = useAircraftStore((state) => state.chaos);
  const setChaos = useAircraftStore((state) => state.setChaos);
  const [glitchActive, setGlitchActive] = useState(false);

  const triggerGlitch = () => {
    setGlitchActive(true);
    setTimeout(() => setGlitchActive(false), 450);
  };

  const handleToggle = (key: keyof typeof chaos) => {
    triggerGlitch();
    setChaos({ [key]: !chaos[key] });
  };

  const hasAnyFault = Object.values(chaos).some(Boolean);

  return (
    <>
      {/* Glitch Overlay when faults trigger */}
      {glitchActive && <div className="chaos-glitch-screen" aria-hidden="true" />}

      {/* Trigger Button in bottom dock */}
      <button
        type="button"
        className={`chaos-dock-btn ${hasAnyFault ? 'is-fault-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Chaos Engineering & Fault Injection Console"
      >
        <span className="chaos-hazard-stripe-icon" />
        <Flame size={14} className={hasAnyFault ? 'text-amber-400 animate-bounce' : 'text-slate-400'} />
        <span>CHAOS LAB</span>
        {hasAnyFault && <span className="fault-count-dot">!</span>}
      </button>

      {/* Modal / Drawer Console */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="chaos-panel-drawer radar-glass-panel"
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            aria-label="Chaos Engineering Console"
          >
            {/* Hazard Stripe Banner */}
            <div className="chaos-hazard-strip">
              <span>HAZARD TESTING · SYSTEM RESILIENCE LAB</span>
            </div>

            <div className="chaos-panel-head">
              <div className="chaos-title-group">
                <AlertOctagon size={16} className="text-amber-400" />
                <h3>FAULT INJECTION CONSOLE</h3>
              </div>
              <button
                type="button"
                className="chaos-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close chaos panel"
              >
                <X size={15} />
              </button>
            </div>

            <p className="chaos-panel-desc">
              Inject intentional network anomalies, protocol rate limits, and transponder emergency states
              to test radar resilience and failover logic in real time.
            </p>

            <div className="chaos-toggles-list">
              {/* Toggle 1: 429 Rate Limit */}
              <label className={`chaos-toggle-row ${chaos.forceRateLimit ? 'is-active' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-title">FORCE 429 RATE LIMIT</span>
                  <span className="toggle-sub">Simulates upstream OpenSky anonymous quota block</span>
                </div>
                <input
                  type="checkbox"
                  checked={chaos.forceRateLimit}
                  onChange={() => handleToggle('forceRateLimit')}
                  className="chaos-checkbox"
                />
              </label>

              {/* Toggle 2: Packet Loss */}
              <label className={`chaos-toggle-row ${chaos.forcePacketLoss ? 'is-active' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-title">SIMULATE 503 PACKET LOSS</span>
                  <span className="toggle-sub">Drops API responses to trigger exponential backoff</span>
                </div>
                <input
                  type="checkbox"
                  checked={chaos.forcePacketLoss}
                  onChange={() => handleToggle('forcePacketLoss')}
                  className="chaos-checkbox"
                />
              </label>

              {/* Toggle 3: Squawk 7700 Emergency */}
              <label className={`chaos-toggle-row ${chaos.forceEmergencySquawk ? 'is-active' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-title text-rose-400 font-semibold">
                    INJECT SQUAWK 7700 (MAYDAY)
                  </span>
                  <span className="toggle-sub">Triggers red expanding shockwave ring & warning vignette</span>
                </div>
                <input
                  type="checkbox"
                  checked={chaos.forceEmergencySquawk}
                  onChange={() => handleToggle('forceEmergencySquawk')}
                  className="chaos-checkbox"
                />
              </label>

              {/* Toggle 4: GPS Jitter */}
              <label className={`chaos-toggle-row ${chaos.forceGpsJitter ? 'is-active' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-title">INJECT GPS TELEMETRY JITTER</span>
                  <span className="toggle-sub">Tests dead-reckoning smoothing against erratic coordinates</span>
                </div>
                <input
                  type="checkbox"
                  checked={chaos.forceGpsJitter}
                  onChange={() => handleToggle('forceGpsJitter')}
                  className="chaos-checkbox"
                />
              </label>

              {/* Toggle 5: Complete Offline Mode */}
              <label className={`chaos-toggle-row ${chaos.forceOffline ? 'is-active' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-title">OFFLINE / AIR-GAP SIMULATION</span>
                  <span className="toggle-sub">Cuts data link and verifies local cached vector display</span>
                </div>
                <input
                  type="checkbox"
                  checked={chaos.forceOffline}
                  onChange={() => handleToggle('forceOffline')}
                  className="chaos-checkbox"
                />
              </label>
            </div>

            {hasAnyFault && (
              <button
                type="button"
                className="chaos-reset-all-btn"
                onClick={() => {
                  triggerGlitch();
                  setChaos({
                    forceRateLimit: false,
                    forcePacketLoss: false,
                    forceEmergencySquawk: false,
                    forceGpsJitter: false,
                    forceOffline: false,
                  });
                }}
              >
                RESTORE NOMINAL CONDITIONS
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

