// src/components/landing/LandingPage.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Compass,
  Layers,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  Signal,
  Wind,
  Zap,
} from 'lucide-react';
import GlobeHero from './GlobeHero';
import { useAircraftStore, SECTORS } from '../../lib/state/useAircraftStore';
import { soundFx } from '../../lib/audio/AudioSynthesizer';

interface LandingPageProps {
  onEnterDashboard: () => void;
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#@%&+-/*';

function useScrambleText(finalText: string, delayMs: number = 300) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let iteration = 0;
    let interval: NodeJS.Timeout;

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        setDisplayedText(
          finalText
            .split('')
            .map((char, index) => {
              if (char === ' ') return ' ';
              if (index < iteration) {
                return finalText[index];
              }
              return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            })
            .join('')
        );

        if (iteration >= finalText.length) {
          clearInterval(interval);
        }
        iteration += 1 / 2;
      }, 35);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [finalText, delayMs]);

  return displayedText;
}

export default function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [isZooming, setIsZooming] = useState(false);
  const titleText = useScrambleText('NIGHT OPERATIONS CONTROL ROOM', 200);
  const subtitleText = useScrambleText('TACTICAL RADAR · PRECISION TELEMETRY · FAULT RESILIENT', 600);

  const aircraft = useAircraftStore((state) => state.aircraft);
  const health = useAircraftStore((state) => state.health);
  const activeSector = useAircraftStore((state) => state.activeSector);
  const setSector = useAircraftStore((state) => state.setSector);

  const aircraftList = Object.values(aircraft);
  const liveCount = aircraftList.length > 0 ? aircraftList.length : 42;
  const airborneCount = aircraftList.length > 0 ? aircraftList.filter((a) => !a.onGround).length : 38;

  const handleLaunch = () => {
    soundFx.playTargetLock();
    setIsZooming(true);
  };

  return (
    <div className={`landing-viewport ${isZooming ? 'is-launching' : ''}`}>
      {/* 3D Earth Globe Backdrop */}
      <GlobeHero isZoomingIn={isZooming} onTransitionComplete={onEnterDashboard} />

      {/* Atmospheric Vignette & Grid */}
      <div className="landing-grid-overlay" aria-hidden="true" />
      <div className="landing-vignette" aria-hidden="true" />

      {/* Main Landing Content Container */}
      <div className="landing-content">
        {/* Top Minimal Nav */}
        <header className="landing-nav">
          <div className="brand-group">
            <span className="brand-radar-icon">
              <Radio size={16} className="text-cyan-400 animate-pulse" />
            </span>
            <div className="brand-text">
              <span className="brand-title">AIR<span>SPACE</span></span>
              <span className="brand-tag">NIGHT OPS · CONSOLE v2.4</span>
            </div>
          </div>

          <div className="landing-sector-pills">
            {SECTORS.slice(0, 3).map((sector) => (
              <button
                key={sector.id}
                type="button"
                className={`sector-pill ${activeSector.id === sector.id ? 'is-active' : ''}`}
                onClick={() => setSector(sector.id)}
              >
                {sector.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="launch-btn-small"
            onClick={handleLaunch}
          >
            Launch Radar <ArrowRight size={14} />
          </button>
        </header>

        {/* Hero Headline Section */}
        <section className="landing-hero-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hero-badge"
          >
            <span className="hero-badge-dot" />
            LIVE AIR TRAFFIC CONTROL
          </motion.div>

          <h1 className="hero-headline">
            {titleText || 'NIGHT OPERATIONS CONTROL ROOM'}
          </h1>

          <p className="hero-subhead">
            {subtitleText || 'TACTICAL RADAR · PRECISION TELEMETRY · FAULT RESILIENT'}
          </p>

          <div className="hero-actions">
            <motion.button
              type="button"
              className="launch-radar-btn"
              onClick={handleLaunch}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="btn-glow-ring" />
              <Play size={18} fill="currentColor" />
              <span>LAUNCH RADAR CONSOLE</span>
              <span className="btn-corner-bl" />
              <span className="btn-corner-tr" />
            </motion.button>

            <span className="hero-hotkey-hint">
              Press <b>Enter</b> or click to engage radar
            </span>
          </div>
        </section>

        {/* Live Stat Strip Under Hero */}
        <section className="landing-stat-strip" aria-label="Real-time telemetry strip">
          <div className="stat-card">
            <div className="stat-card-label">
              <Wind size={14} className="text-cyan-400" />
              <span>ACTIVE CONTACTS</span>
            </div>
            <strong className="stat-card-val tabular-nums">{liveCount}</strong>
            <span className="stat-card-sub">{airborneCount} airborne in sector</span>
          </div>

          <div className="stat-card">
            <div className="stat-card-label">
              <Signal size={14} className="text-emerald-400" />
              <span>DATA TELEMETRY</span>
            </div>
            <strong className="stat-card-val text-emerald-400">
              {health.status === 'live' ? 'NOMINAL' : 'ADAPTIVE'}
            </strong>
            <span className="stat-card-sub">OpenSky Network ADS-B</span>
          </div>

          <div className="stat-card">
            <div className="stat-card-label">
              <Zap size={14} className="text-amber-400" />
              <span>DEAD RECKONING</span>
            </div>
            <strong className="stat-card-val text-amber-300">60 FPS</strong>
            <span className="stat-card-sub">Continuous coordinate glide</span>
          </div>

          <div className="stat-card">
            <div className="stat-card-label">
              <Compass size={14} className="text-purple-400" />
              <span>3D SEPARATION</span>
            </div>
            <strong className="stat-card-val text-purple-300">60° TILT</strong>
            <span className="stat-card-sub">Altitude stems & shadows</span>
          </div>
        </section>

        {/* Feature Cards Grid & Mini Interactive Radar Demo */}
        <section className="landing-feature-section">
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-header">
                <span className="feature-icon"><Layers size={18} /></span>
                <span className="feature-id">01 / TACTICAL DISPLAY</span>
              </div>
              <h3>2D & 3D Radar Operations</h3>
              <p>
                Seamlessly toggle between top-down 2D radar, 60° tactical 3D tilt with vertical
                altitude stems, and orbital perspective with smooth camera easing.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <span className="feature-icon"><Activity size={18} /></span>
                <span className="feature-id">02 / DEAD RECKONING</span>
              </div>
              <h3>Sub-Second Smooth Glide</h3>
              <p>
                No stuttering between poll cycles. High-precision vector extrapolation glides aircraft
                along their true track with shortest-path heading interpolation.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <span className="feature-icon"><RotateCcw size={18} /></span>
                <span className="feature-id">03 / BLACKBOX REPLAY</span>
              </div>
              <h3>Historic Timeline Scrubber</h3>
              <p>
                Scrub through historical flight states with a violet-tinted timeline scrubber,
                playback speed controls, and traffic density waveforms.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-header">
                <span className="feature-icon"><ShieldAlert size={18} /></span>
                <span className="feature-id">04 / CHAOS RESILIENCE</span>
              </div>
              <h3>Simulated Anomaly Testing</h3>
              <p>
                Test real-world edge cases with the chaos console: inject 429 rate limits,
                packet loss, emergency squawk 7700 alerts, and GPS jitter.
              </p>
            </div>
          </div>

          {/* Mini Interactive Demo Card: Looping Plane with Fading Trail */}
          <div className="mini-radar-demo-card">
            <div className="mini-demo-head">
              <span className="mini-demo-tag">LIVE DEMO · DEAD RECKONING GLIDE</span>
              <span className="mini-demo-coords">12.97° N / 79.13° E</span>
            </div>
            <MiniRadarDemo />
            <div className="mini-demo-foot">
              <span>TARGET: <b>AIC102</b></span>
              <span>ALT: <b>FL340 (10,360m)</b></span>
              <span>GS: <b>875 km/h</b></span>
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <span>AIRSPACE NIGHT OPERATIONS · MODERN AIR TRAFFIC CONTROL</span>
          <button type="button" onClick={handleLaunch} className="footer-launch-link">
            Open Full Console →
          </button>
        </footer>
      </div>
    </div>
  );
}

// Mini interactive canvas demo card: looping plane gliding with a fading altitude-colored trail
function MiniRadarDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;
    const trail: { x: number; y: number; heading: number }[] = [];

    const render = () => {
      animId = requestAnimationFrame(render);
      t += 0.015;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.38;
      const ry = height * 0.32;

      // Figure-8 racetrack path
      const x = cx + rx * Math.sin(t);
      const y = cy + ry * Math.sin(t * 2) * 0.6;

      // Calculate tangent angle for heading
      const dx = rx * Math.cos(t);
      const dy = ry * 2 * Math.cos(t * 2) * 0.6;
      const heading = Math.atan2(dy, dx);

      trail.unshift({ x, y, heading });
      if (trail.length > 50) trail.pop();

      // Clear with dark navy
      ctx.fillStyle = '#060b14';
      ctx.fillRect(0, 0, width, height);

      // Radar Concentric Rings
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.stroke();

      // Radar Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();

      // Rotating Radar Sweep Beam
      const sweepAngle = t * 1.5;
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140);
      sweepGrad.addColorStop(0, 'rgba(34, 211, 238, 0.18)');
      sweepGrad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 140, sweepAngle, sweepAngle + 0.35);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // Draw Fading Trail
      for (let i = trail.length - 1; i > 0; i--) {
        const p1 = trail[i];
        const p2 = trail[i - 1];
        const alpha = (1 - i / trail.length) * 0.85;

        ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
        ctx.lineWidth = 2.5 * (1 - i / trail.length) + 0.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Draw Looping Jet Icon
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(heading + Math.PI / 2);

      // Jet Glow
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(3, -2);
      ctx.lineTo(8, 2);
      ctx.lineTo(8, 4);
      ctx.lineTo(2, 2);
      ctx.lineTo(2, 6);
      ctx.lineTo(4, 8);
      ctx.lineTo(4, 9);
      ctx.lineTo(0, 8);
      ctx.lineTo(-4, 9);
      ctx.lineTo(-4, 8);
      ctx.lineTo(-2, 6);
      ctx.lineTo(-2, 2);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-8, 2);
      ctx.lineTo(-3, -2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="mini-demo-canvas-wrap">
      <canvas ref={canvasRef} width={340} height={200} className="mini-demo-canvas" />
    </div>
  );
}
