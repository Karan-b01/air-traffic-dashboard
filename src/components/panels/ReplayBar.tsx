// src/components/panels/ReplayBar.tsx
'use client';

import { useEffect } from 'react';
import { FastForward, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

export default function ReplayBar() {
  const replay = useAircraftStore((state) => state.replay);
  const startReplay = useAircraftStore((state) => state.startReplay);
  const stopReplay = useAircraftStore((state) => state.stopReplay);
  const setReplayIndex = useAircraftStore((state) => state.setReplayIndex);
  const setReplaySpeed = useAircraftStore((state) => state.setReplaySpeed);
  const toggleReplayPlay = useAircraftStore((state) => state.toggleReplayPlay);

  const { isReplaying, snapshots, currentIndex, speed, isPlaying } = replay;
  const snapshotCount = snapshots.length;

  // Auto-play timer for replay
  useEffect(() => {
    if (!isReplaying || !isPlaying || snapshotCount === 0) return;

    const intervalMs = Math.round(1000 / speed);
    const timer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % snapshotCount;
      setReplayIndex(nextIndex);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isReplaying, isPlaying, currentIndex, snapshotCount, speed, setReplayIndex]);

  if (!isReplaying) {
    return (
      <button
        type="button"
        className="replay-launcher-btn"
        onClick={startReplay}
        title="Enter Blackbox Historic Replay Mode"
        disabled={snapshotCount === 0}
      >
        <RotateCcw size={13} className="text-purple-400" />
        <span>REPLAY ({snapshotCount})</span>
      </button>
    );
  }

  const currentSnapshot = snapshots[currentIndex];
  const timeStr = currentSnapshot
    ? new Date(currentSnapshot.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'RECORDING';

  return (
    <div className="replay-console-bar radar-glass-panel animate-in slide-in-from-bottom duration-200" aria-label="Replay Controls">
      <div className="replay-head">
        <span className="replay-live-badge">● BLACKBOX REPLAY</span>
        <span className="replay-time font-mono">{timeStr}</span>
        <span className="replay-frame-counter font-mono">
          FRAME {currentIndex + 1} / {snapshotCount}
        </span>
      </div>

      <div className="replay-controls-row">
        <button
          type="button"
          className="replay-ctrl-btn"
          onClick={toggleReplayPlay}
          aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* Timeline Scrubber */}
        <div className="replay-scrubber-track">
          <input
            type="range"
            min={0}
            max={Math.max(0, snapshotCount - 1)}
            value={currentIndex}
            onChange={(e) => setReplayIndex(parseInt(e.target.value, 10))}
            className="replay-slider"
          />
        </div>

        {/* Speed Controls */}
        <div className="replay-speed-selector">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              type="button"
              className={`replay-speed-btn ${speed === s ? 'is-selected' : ''}`}
              onClick={() => setReplaySpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          type="button"
          className="replay-exit-btn"
          onClick={stopReplay}
          title="Exit replay and return to live radar"
        >
          <X size={14} /> EXIT
        </button>
      </div>
    </div>
  );
}

