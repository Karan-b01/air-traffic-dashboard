// src/components/panels/EventFeedPanel.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ArrowDown, ArrowUp, ChevronDown, ChevronUp, Radio, ShieldAlert } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

export default function EventFeedPanel() {
  const events = useAircraftStore((state) => state.events);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const [isExpanded, setIsExpanded] = useState(false);

  const displayedEvents = isExpanded ? events.slice(0, 15) : events.slice(0, 3);

  return (
    <aside className="event-feed-panel radar-glass-panel" aria-label="ATC Event Stream">
      <span className="panel-corner corner-tl" aria-hidden="true" />
      <span className="panel-corner corner-tr" aria-hidden="true" />
      <span className="panel-corner corner-bl" aria-hidden="true" />
      <span className="panel-corner corner-br" aria-hidden="true" />

      <div className="event-feed-head">
        <div className="event-feed-title">
          <Radio size={13} className="text-cyan-400" />
          <span>SECTOR ATC TRANSMISSIONS</span>
        </div>
        <button
          type="button"
          className="event-feed-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse event feed' : 'Expand event feed'}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      <div className="event-cards-stack">
        <AnimatePresence initial={false}>
          {displayedEvents.map((event) => {
            const isEmergency = event.type === 'emergency';
            const isClimb = event.type === 'climb';
            const isDescent = event.type === 'descent';

            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className={`event-card-item ${isEmergency ? 'is-emergency' : ''}`}
                onClick={() => {
                  const icao = event.callsign.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
                  if (icao) selectAircraft(icao);
                }}
              >
                <div className="event-card-icon">
                  {isEmergency ? (
                    <ShieldAlert size={14} className="text-rose-400 animate-pulse" />
                  ) : isClimb ? (
                    <ArrowUp size={13} className="text-emerald-400" />
                  ) : isDescent ? (
                    <ArrowDown size={13} className="text-amber-400" />
                  ) : (
                    <AlertCircle size={13} className="text-cyan-400" />
                  )}
                </div>

                <div className="event-card-content">
                  <div className="event-card-top">
                    <span className="event-card-callsign font-mono">{event.callsign}</span>
                    <span className="event-card-time font-mono">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="event-card-msg">{event.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </aside>
  );
}

