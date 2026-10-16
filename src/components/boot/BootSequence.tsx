// src/components/boot/BootSequence.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Radio, Server, Shield, Terminal } from 'lucide-react';
import { soundFx } from '../../lib/audio/AudioSynthesizer';

interface BootSequenceProps {
  onBootComplete: () => void;
}

interface BootStep {
  id: string;
  label: string;
  sublabel: string;
  icon: typeof Server;
  durationMs: number;
}

const BOOT_STEPS: BootStep[] = [
  {
    id: 'proxy',
    label: 'SECURE PROXY GATEWAY',
    sublabel: 'Bypassing CORS · Server-side token rotation ready',
    icon: Server,
    durationMs: 380,
  },
  {
    id: 'opensky',
    label: 'OPENSKY ADS-B TELEMETRY LINK',
    sublabel: 'Synchronizing transponder stream & 10s state vectors',
    icon: Radio,
    durationMs: 440,
  },
  {
    id: 'cache',
    label: 'LOCAL VECTOR CACHE & BLACKBOX',
    sublabel: 'IndexedDB buffer verified · 30-frame snapshot storage online',
    icon: Shield,
    durationMs: 340,
  },
  {
    id: 'maplibregl',
    label: 'MAPLIBRE WEBGL 3D PROJECTION ENGINE',
    sublabel: 'Terrain shaders compiled · Altitude stem geometry primed',
    icon: Terminal,
    durationMs: 360,
  },
];

export default function BootSequence({ onBootComplete }: BootSequenceProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runStep = (index: number) => {
      if (index >= BOOT_STEPS.length) {
        setProgress(100);
        soundFx.playTargetLock();
        timeoutId = setTimeout(() => {
          onBootComplete();
        }, 350);
        return;
      }

      const step = BOOT_STEPS[index];
      timeoutId = setTimeout(() => {
        soundFx.playBootCheck();
        setCompletedSteps((prev) => [...prev, step.id]);
        setCurrentStepIndex(index + 1);
        setProgress(Math.round(((index + 1) / BOOT_STEPS.length) * 100));
        runStep(index + 1);
      }, step.durationMs);
    };

    runStep(0);

    return () => clearTimeout(timeoutId);
  }, [onBootComplete]);

  return (
    <motion.div
      className="boot-screen-overlay"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.45 }}
    >
      <div className="boot-terminal-window">
        {/* Terminal Header */}
        <div className="boot-terminal-head">
          <div className="boot-terminal-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="boot-terminal-title">ATC-SYS // BOOT INITIALIZATION SEQUENCE</span>
          <button
            type="button"
            className="boot-skip-button"
            onClick={onBootComplete}
          >
            SKIP [ESC]
          </button>
        </div>

        {/* Radar Instrument Watermark */}
        <div className="boot-radar-graphic" aria-hidden="true">
          <div className="boot-radar-circle circle-1" />
          <div className="boot-radar-circle circle-2" />
          <div className="boot-radar-circle circle-3" />
          <div className="boot-radar-sweep-beam" />
        </div>

        {/* Boot Steps Checklist */}
        <div className="boot-steps-list">
          {BOOT_STEPS.map((step, idx) => {
            const isDone = completedSteps.includes(step.id);
            const isCurrent = idx === currentStepIndex;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`boot-step-item ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-active' : ''}`}
              >
                <div className="boot-step-icon">
                  {isDone ? (
                    <CheckCircle2 size={18} className="text-emerald-400 animate-in fade-in zoom-in duration-150" />
                  ) : isCurrent ? (
                    <Loader2 size={18} className="text-cyan-400 animate-spin" />
                  ) : (
                    <Icon size={18} className="text-slate-600" />
                  )}
                </div>

                <div className="boot-step-text">
                  <div className="boot-step-main">
                    <span className="boot-step-label">{step.label}</span>
                    <span className={`boot-step-status ${isDone ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                      {isDone ? '[ VERIFIED ]' : isCurrent ? '[ TESTING... ]' : '[ PENDING ]'}
                    </span>
                  </div>
                  <span className="boot-step-sub">{step.sublabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Boot Progress Bar */}
        <div className="boot-progress-wrap">
          <div className="boot-progress-labels">
            <span>SYSTEM HARDENING STATUS</span>
            <span className="tabular-nums font-mono text-cyan-400">{progress}%</span>
          </div>
          <div className="boot-progress-track">
            <motion.div
              className="boot-progress-fill"
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>

        {/* Terminal Footnote */}
        <div className="boot-terminal-foot">
          <span>AIRSPACE TELEMETRY KERNEL v2.4</span>
          <span>SOUTHERN SECTOR · ALL SYSTEMS NOMINAL</span>
        </div>
      </div>
    </motion.div>
  );
}

