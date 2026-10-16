// src/components/map/AltitudeCorridor.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, Minus, Plane, X } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';
import { getAltitudeColor } from './AircraftMap';

export default function AltitudeCorridor() {
  const isOpen = useAircraftStore((state) => state.altitudeCorridorOpen);
  const toggle = useAircraftStore((state) => state.toggleAltitudeCorridor);
  const aircraft = useAircraftStore((state) => state.aircraft);
  const selectedId = useAircraftStore((state) => state.selectedId);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const activeSector = useAircraftStore((state) => state.activeSector);

  const aircraftList = Object.values(aircraft).filter(
    (a) => Number.isFinite(a.longitude) && Number.isFinite(a.latitude) && !a.onGround
  );

  const { lomin, lomax } = activeSector.bbox;
  const lonRange = lomax - lomin || 15;
  const MAX_ALT = 13000; // ~FL430 in meters

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          className="altitude-corridor-drawer"
          initial={{ y: 140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 140, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          aria-label="Vertical Airspace Altitude Profile"
        >
          <div className="corridor-head">
            <div className="corridor-title-group">
              <span className="corridor-tag"><Plane size={13} /> VERTICAL AIRSPACE CORRIDOR</span>
              <span className="corridor-subtitle">
                SIDE-PROFILE ELEVATION VIEW · {activeSector.name.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              className="corridor-close-btn"
              onClick={toggle}
              aria-label="Close altitude corridor"
            >
              <X size={15} />
            </button>
          </div>

          <div className="corridor-viewport">
            {/* Flight Level Grid Lines */}
            <div className="corridor-level-line level-fl400">
              <span className="level-tag">FL400 (12.2km)</span>
            </div>
            <div className="corridor-level-line level-fl300">
              <span className="level-tag">FL300 (9.1km)</span>
            </div>
            <div className="corridor-level-line level-fl200">
              <span className="level-tag">FL200 (6.1km)</span>
            </div>
            <div className="corridor-level-line level-fl100">
              <span className="level-tag">FL100 (3.0km)</span>
            </div>
            <div className="corridor-level-line level-gnd">
              <span className="level-tag">TERRAIN GND</span>
            </div>

            {/* Aircraft Contacts Plotted by Longitude & Altitude */}
            <div className="corridor-contacts-layer">
              {aircraftList.map((plane) => {
                const alt = plane.baroAltitude ?? 0;
                const altPercent = Math.max(4, Math.min(94, (alt / MAX_ALT) * 100));
                const lonPercent = Math.max(5, Math.min(95, ((plane.longitude - lomin) / lonRange) * 100));
                const isSelected = plane.icao24 === selectedId;
                const color = getAltitudeColor(plane.baroAltitude, plane.onGround, plane.isEmergency);

                const vRate = plane.verticalRate || 0;
                const isClimbing = vRate > 1.5;
                const isDescending = vRate < -1.5;

                return (
                  <button
                    key={plane.icao24}
                    type="button"
                    className={`corridor-plane-blip ${isSelected ? 'is-selected' : ''}`}
                    style={{
                      left: `${lonPercent}%`,
                      bottom: `${altPercent}%`,
                      borderColor: color,
                    }}
                    onClick={() => selectAircraft(plane.icao24)}
                    title={`${plane.callsign.trim() || plane.icao24}: ${Math.round(alt)}m`}
                  >
                    <span className="blip-dot" style={{ backgroundColor: color }} />
                    <span className="blip-label" style={{ color }}>
                      {plane.callsign.trim() || plane.icao24.toUpperCase()}
                      {isClimbing ? (
                        <ArrowUp size={10} className="inline ml-0.5 text-emerald-400" />
                      ) : isDescending ? (
                        <ArrowDown size={10} className="inline ml-0.5 text-amber-400" />
                      ) : (
                        <Minus size={8} className="inline ml-0.5 text-slate-400" />
                      )}
                    </span>
                    <span className="blip-alt">
                      FL{Math.round((alt * 3.28084) / 100)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

