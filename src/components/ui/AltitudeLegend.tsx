// src/components/ui/AltitudeLegend.tsx
'use client';

import { useAircraftStore } from '../../lib/state/useAircraftStore';

interface AltitudeTier {
  id: string;
  label: string;
  color: string;
  min: number;
  max: number;
}

const ALTITUDE_TIERS: AltitudeTier[] = [
  { id: 'low', label: '<FL50', color: '#fb923c', min: 0, max: 1500 },
  { id: 'mid-low', label: 'FL50-150', color: '#facc15', min: 1500, max: 4500 },
  { id: 'mid', label: 'FL150-280', color: '#22d3ee', min: 4500, max: 8500 },
  { id: 'high', label: 'FL280-360', color: '#818cf8', min: 8500, max: 11000 },
  { id: 'ultra', label: 'FL360+', color: '#a78bfa', min: 11000, max: 15000 },
];

export default function AltitudeLegend() {
  const filters = useAircraftStore((state) => state.filters);
  const setFilter = useAircraftStore((state) => state.setFilter);
  const resetFilter = useAircraftStore((state) => state.resetFilter);

  const handleTierClick = (tier: AltitudeTier) => {
    // If already filtering by this tier, reset filter
    if (filters.minAltitude === tier.min && filters.maxAltitude === tier.max) {
      resetFilter();
    } else {
      setFilter({ minAltitude: tier.min, maxAltitude: tier.max, airborneOnly: true });
    }
  };

  return (
    <div className="altitude-legend-strip radar-glass-panel font-mono" aria-label="Altitude legend and band filter">
      <span className="legend-title">ALTITUDE:</span>
      <div className="legend-tiers-row">
        {ALTITUDE_TIERS.map((tier) => {
          const isActive = filters.minAltitude === tier.min && filters.maxAltitude === tier.max;
          return (
            <button
              key={tier.id}
              type="button"
              className={`legend-tier-pill ${isActive ? 'is-active' : ''}`}
              onClick={() => handleTierClick(tier)}
              title={`Filter to ${tier.label}`}
            >
              <span className="tier-dot" style={{ backgroundColor: tier.color }} />
              <span className="tier-text">{tier.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

