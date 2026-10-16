// src/components/ui/OnboardingTour.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Compass, Radio, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';

const TOUR_STEPS = [
  {
    id: 'radar',
    title: 'LIVE 60 FPS RADAR GLIDE',
    desc: 'Aircraft glide smoothly between 10s OpenSky cycles using vector dead reckoning and shortest-path heading rotation.',
    icon: Radio,
  },
  {
    id: '3d',
    title: '3D TACTICAL SEPARATION',
    desc: 'Switch to 3D Tilt in the topbar to view vertical altitude stems and ground shadows, instantly assessing vertical separation.',
    icon: Compass,
  },
  {
    id: 'chaos',
    title: 'CHAOS RESILIENCE & SEARCH',
    desc: 'Press Ctrl+K anytime for fast flight lookup. Open the Chaos Lab in the bottom dock to simulate 429 rate limits and emergency squawks.',
    icon: ShieldAlert,
  },
];

export default function OnboardingTour() {
  const dismissed = useAircraftStore((state) => state.onboardingDismissed);
  const setDismissed = useAircraftStore((state) => state.setOnboardingDismissed);
  const [currentStep, setCurrentStep] = useState(0);

  if (dismissed) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setDismissed(true);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="onboarding-tour-toast radar-glass-panel"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25 }}
      >
        <span className="panel-corner corner-tl" aria-hidden="true" />
        <span className="panel-corner corner-tr" aria-hidden="true" />
        <span className="panel-corner corner-bl" aria-hidden="true" />
        <span className="panel-corner corner-br" aria-hidden="true" />

        <div className="tour-head">
          <div className="tour-tag font-mono">
            <Sparkles size={13} className="text-cyan-400" />
            <span>RADAR ONBOARDING [{currentStep + 1} / {TOUR_STEPS.length}]</span>
          </div>
          <button
            type="button"
            className="tour-close-btn"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss tour"
          >
            <X size={14} />
          </button>
        </div>

        <div className="tour-content">
          <div className="tour-icon-wrap">
            <Icon size={20} className="text-cyan-400" />
          </div>
          <div className="tour-copy">
            <h4 className="tour-step-title font-mono">{step.title}</h4>
            <p className="tour-step-desc">{step.desc}</p>
          </div>
        </div>

        <div className="tour-foot">
          <button
            type="button"
            className="tour-skip-link font-mono"
            onClick={() => setDismissed(true)}
          >
            Skip Guide
          </button>
          <button
            type="button"
            className="tour-next-btn font-mono"
            onClick={handleNext}
          >
            {isLast ? (
              <><span>ACKNOWLEDGE</span> <Check size={12} /></>
            ) : (
              <><span>NEXT</span> <ChevronRight size={12} /></>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

