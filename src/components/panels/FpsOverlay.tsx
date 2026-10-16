// src/components/panels/FpsOverlay.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

export default function FpsOverlay() {
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);
  const aircraftCount = useAircraftStore((state) => Object.keys(state.aircraft).length);

  const frameTimes = useRef<number[]>([]);
  const lastTime = useRef<number>(performance.now());

  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const delta = now - lastTime.current;
      lastTime.current = now;

      frameTimes.current.push(delta);
      if (frameTimes.current.length > 30) {
        frameTimes.current.shift();
      }

      const avgDelta =
        frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
      const currentFps = Math.min(60, Math.round(1000 / avgDelta));

      setFps(currentFps);
      setFrameTimeMs(parseFloat(avgDelta.toFixed(1)));

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const fpsColor =
    fps >= 55 ? 'text-emerald-400' : fps >= 35 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="fps-hud-overlay font-mono" title="Live WebGL Render Performance">
      <span className="fps-dot animate-pulse" />
      <span className={`fps-val ${fpsColor}`}>{fps} FPS</span>
      <span className="fps-frametime text-slate-500">({frameTimeMs}ms)</span>
      <span className="fps-divider text-slate-700">|</span>
      <span className="fps-planes text-cyan-400">{aircraftCount} BLIPS</span>
    </div>
  );
}

