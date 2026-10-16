// src/components/panels/AlertRulesModal.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useAircraftStore } from '../../lib/state/useAircraftStore';
import type { AlertRule } from '../../lib/persistence/db';

export default function AlertRulesModal() {
  const isOpen = useAircraftStore((state) => state.alertsModalOpen);
  const toggle = useAircraftStore((state) => state.toggleAlertsModal);
  const alertRules = useAircraftStore((state) => state.alertRules);
  const addAlertRule = useAircraftStore((state) => state.addAlertRule);
  const toggleAlertRule = useAircraftStore((state) => state.toggleAlertRule);
  const removeAlertRule = useAircraftStore((state) => state.removeAlertRule);

  // Form State
  const [name, setName] = useState('');
  const [field, setField] = useState<'altitude' | 'speed' | 'verticalRate' | 'geofence'>('altitude');
  const [operator, setOperator] = useState<'<' | '>'>('<');
  const [value, setValue] = useState(2000);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addAlertRule({
      name: name.trim(),
      field,
      operator,
      value: Number(value),
      enabled: true,
    });
    setName('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="alerts-modal-backdrop" onClick={toggle}>
          <motion.div
            className="alerts-modal radar-glass-panel"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Configurable Alert Rules Engine"
          >
            <span className="panel-corner corner-tl" aria-hidden="true" />
            <span className="panel-corner corner-tr" aria-hidden="true" />
            <span className="panel-corner corner-bl" aria-hidden="true" />
            <span className="panel-corner corner-br" aria-hidden="true" />

            <div className="alerts-modal-head">
              <div className="alerts-title-group">
                <ShieldAlert size={18} className="text-amber-400" />
                <div>
                  <h2>AIRSPACE ALERT RULES ENGINE</h2>
                  <span className="alerts-subtitle font-mono">
                    AUTOMATIC SECTOR THRESHOLD EVALUATION
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="alerts-close-btn"
                onClick={toggle}
                aria-label="Close alerts modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Active Rules List */}
            <div className="alerts-rules-list">
              <span className="list-title font-mono">ACTIVE SECTOR SURVEILLANCE RULES</span>
              {alertRules.length === 0 ? (
                <div className="empty-rules font-mono text-slate-500">
                  No alert rules defined. Create one below to monitor specific telemetry thresholds.
                </div>
              ) : (
                alertRules.map((rule) => (
                  <div key={rule.id} className="rule-card font-mono">
                    <div className="rule-info">
                      <span className="rule-name font-bold">{rule.name}</span>
                      <span className="rule-condition text-slate-400">
                        IF {rule.field.toUpperCase()} {rule.operator} {rule.value}
                        {rule.field === 'altitude' ? 'm' : rule.field === 'speed' ? 'km/h' : rule.field === 'geofence' ? 'km' : 'm/s'}
                      </span>
                    </div>

                    <div className="rule-actions">
                      <button
                        type="button"
                        className={`rule-toggle-btn ${rule.enabled ? 'is-enabled' : ''}`}
                        onClick={() => toggleAlertRule(rule.id)}
                      >
                        {rule.enabled ? 'ARMED' : 'DISARMED'}
                      </button>
                      <button
                        type="button"
                        className="rule-del-btn"
                        onClick={() => removeAlertRule(rule.id)}
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Create Rule Form */}
            <form onSubmit={handleCreate} className="create-rule-form radar-glass-panel">
              <span className="form-title font-mono"><Plus size={13} /> CONFIGURE NEW TRIGGER</span>

              <div className="form-row">
                <input
                  type="text"
                  placeholder="Rule Name (e.g. Terminal Geofence Breach)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rule-input-text font-mono"
                  required
                />
              </div>

              <div className="form-row-grid font-mono">
                <select
                  value={field}
                  onChange={(e) => setField(e.target.value as any)}
                  className="rule-select"
                >
                  <option value="altitude">Altitude (m)</option>
                  <option value="speed">Ground Speed (km/h)</option>
                  <option value="verticalRate">Vertical Rate (m/s)</option>
                  <option value="geofence">Center Distance (km)</option>
                </select>

                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as any)}
                  className="rule-select"
                >
                  <option value="<">Less than (&lt;)</option>
                  <option value=">">Greater than (&gt;)</option>
                </select>

                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="rule-input-num"
                  required
                />
              </div>

              <button type="submit" className="create-rule-submit-btn font-mono">
                ARM MONITORING TRIGGER
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

