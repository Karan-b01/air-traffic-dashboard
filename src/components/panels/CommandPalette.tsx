// src/components/panels/CommandPalette.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Compass,
  Layers,
  MapPin,
  Plane,
  Radio,
  Search,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAircraftStore, SECTORS } from '../../lib/state/useAircraftStore';
import { soundFx } from '../../lib/audio/AudioSynthesizer';

interface CommandItem {
  id: string;
  category: 'aircraft' | 'sector' | 'view' | 'action';
  title: string;
  subtitle: string;
  icon: typeof Plane;
  action: () => void;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const aircraft = useAircraftStore((state) => state.aircraft);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const setSector = useAircraftStore((state) => state.setSector);
  const setViewMode = useAircraftStore((state) => state.setViewMode);
  const toggleRadarSweep = useAircraftStore((state) => state.toggleRadarSweep);
  const toggleDensityHeatmap = useAircraftStore((state) => state.toggleDensityHeatmap);
  const toggleRangeRings = useAircraftStore((state) => state.toggleRangeRings);
  const toggleAltitudeCorridor = useAircraftStore((state) => state.toggleAltitudeCorridor);
  const toggleSound = useAircraftStore((state) => state.toggleSound);
  const soundEnabled = useAircraftStore((state) => state.soundEnabled);
  const triggerMaydayAlert = useAircraftStore((state) => state.triggerMaydayAlert);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Build command list dynamically
  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];

    // Sectors
    SECTORS.forEach((sec) => {
      list.push({
        id: `sector-${sec.id}`,
        category: 'sector',
        title: sec.name,
        subtitle: sec.subtitle,
        icon: MapPin,
        action: () => {
          setSector(sec.id);
          setIsOpen(false);
        },
      });
    });

    // View Modes
    list.push({
      id: 'view-3d',
      category: 'view',
      title: '3D Tactical Tilt (60°)',
      subtitle: 'Altitude stems and ground shadow perspective',
      icon: Compass,
      action: () => {
        setViewMode('3d');
        setIsOpen(false);
      },
    });

    list.push({
      id: 'view-2d',
      category: 'view',
      title: '2D Top-Down Radar View',
      subtitle: 'Flat orthographic aeronautical chart',
      icon: Layers,
      action: () => {
        setViewMode('2d');
        setIsOpen(false);
      },
    });

    list.push({
      id: 'view-globe',
      category: 'view',
      title: 'Orbital Perspective Mode',
      subtitle: 'Wide angle global flight horizon',
      icon: Compass,
      action: () => {
        setViewMode('globe');
        setIsOpen(false);
      },
    });

    // Actions & Overlays
    list.push({
      id: 'action-corridor',
      category: 'action',
      title: 'Toggle Altitude Corridor Profile',
      subtitle: 'Side-elevation vertical airspace slice',
      icon: Activity,
      action: () => {
        toggleAltitudeCorridor();
        setIsOpen(false);
      },
    });

    list.push({
      id: 'action-sweep',
      category: 'action',
      title: 'Toggle Radar Sweep Overlay',
      subtitle: 'Atmospheric rotating radar beam',
      icon: Radio,
      action: () => {
        toggleRadarSweep();
        setIsOpen(false);
      },
    });

    list.push({
      id: 'action-ground',
      category: 'action',
      title: 'Toggle Ground Traffic Visibility',
      subtitle: 'Show or hide aircraft taxis on airport surfaces',
      icon: Plane,
      action: () => {
        const cur = useAircraftStore.getState().filters.showGroundAircraft;
        useAircraftStore.getState().setFilter({ showGroundAircraft: !cur });
        setIsOpen(false);
      },
    });

    list.push({
      id: 'action-heat',
      category: 'action',
      title: 'Toggle Traffic Density Heatmap',
      subtitle: 'Airspace saturation and density layer',
      icon: Layers,
      action: () => {
        toggleDensityHeatmap();
        setIsOpen(false);
      },
    });

    list.push({
      id: 'action-sound',
      category: 'action',
      title: soundEnabled ? 'Mute ATC Audio Synthesizer' : 'Unmute ATC Audio Synthesizer',
      subtitle: 'Synthesizer blips, sirens, and telemetry tones',
      icon: soundEnabled ? VolumeX : Volume2,
      action: () => {
        toggleSound();
        setIsOpen(false);
      },
    });

    list.push({
      id: 'action-mayday',
      category: 'action',
      title: 'Declare Emergency Squawk 7700 (Demo)',
      subtitle: 'Triggers red alert ripple & warning vignette',
      icon: ShieldAlert,
      action: () => {
        triggerMaydayAlert();
        setIsOpen(false);
      },
    });

    // Top Aircraft
    Object.values(aircraft).slice(0, 15).forEach((plane) => {
      const callsign = plane.callsign.trim() || plane.icao24.toUpperCase();
      list.push({
        id: `plane-${plane.icao24}`,
        category: 'aircraft',
        title: callsign,
        subtitle: `${plane.originCountry || 'Airspace'} · ${plane.baroAltitude ? `FL${Math.round((plane.baroAltitude * 3.28084) / 100)}` : 'GND'} · ${plane.icao24.toUpperCase()}`,
        icon: Plane,
        action: () => {
          selectAircraft(plane.icao24);
          setIsOpen(false);
        },
      });
    });

    return list;
  }, [
    aircraft,
    selectAircraft,
    setSector,
    setViewMode,
    toggleAltitudeCorridor,
    toggleRadarSweep,
    toggleDensityHeatmap,
    toggleSound,
    soundEnabled,
    triggerMaydayAlert,
  ]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  return (
    <>
      {/* Trigger Button in Topbar */}
      <button
        type="button"
        className="cmd-palette-trigger"
        onClick={() => setIsOpen(true)}
        title="Open Command Palette (Ctrl+K)"
      >
        <Search size={13} />
        <span className="hidden sm:inline">COMMAND PALETTE</span>
        <kbd className="cmd-kbd">Ctrl K</kbd>
      </button>

      {/* Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className="cmd-palette-backdrop" onClick={() => setIsOpen(false)}>
            <motion.div
              className="cmd-palette-modal radar-glass-panel"
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cmd-input-row">
                <Search size={16} className="text-cyan-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type a command, flight callsign, sector, or action..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="cmd-input"
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="cmd-close-btn"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="cmd-results-list">
                {filteredCommands.length === 0 ? (
                  <div className="cmd-empty">No matching commands or flights found</div>
                ) : (
                  filteredCommands.map((cmd, idx) => {
                    const isSelected = idx === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        className={`cmd-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <div className="cmd-item-icon">
                          <Icon size={15} />
                        </div>
                        <div className="cmd-item-text">
                          <span className="cmd-item-title">{cmd.title}</span>
                          <span className="cmd-item-sub">{cmd.subtitle}</span>
                        </div>
                        <span className="cmd-category-tag">{cmd.category}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="cmd-palette-foot">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>ESC Close</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

