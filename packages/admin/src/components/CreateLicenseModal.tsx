import React, { useState } from 'react';
import './CreateLicenseModal.css';

// Default org ID — in production this should come from a list or be configurable
// For now we use the seed organization. Can be fetched from the API if needed.
const DEFAULT_ORG_ID_PLACEHOLDER = 'paste-org-id-here';

interface CreateLicenseModalProps {
  onSubmit: (data: {
    organizationId: string;
    plan: string;
    seatsEditor: number;
    seatsPlayer: number;
    validUntil: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function CreateLicenseModal({ onSubmit, onClose }: CreateLicenseModalProps) {
  const [orgId, setOrgId] = useState(DEFAULT_ORG_ID_PLACEHOLDER);
  const [plan, setPlan] = useState('PRO');
  const [seatsEditor, setSeatsEditor] = useState(5);
  const [seatsPlayer, setSeatsPlayer] = useState(10);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (orgId === DEFAULT_ORG_ID_PLACEHOLDER || !orgId.trim()) {
      setError('Please enter a valid Organization ID');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        organizationId: orgId.trim(),
        plan,
        seatsEditor,
        seatsPlayer,
        validUntil,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create license');
    } finally {
      setSubmitting(false);
    }
  };

  const planDefaults: Record<string, { editor: number; player: number }> = {
    BASIC: { editor: 1, player: 3 },
    PRO: { editor: 5, player: 10 },
    MAX: { editor: 20, player: 50 },
  };

  const handlePlanChange = (newPlan: string) => {
    setPlan(newPlan);
    const defaults = planDefaults[newPlan];
    if (defaults) {
      setSeatsEditor(defaults.editor);
      setSeatsPlayer(defaults.player);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New License</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Organization ID</label>
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="UUID of organization"
              className={orgId === DEFAULT_ORG_ID_PLACEHOLDER ? 'input-placeholder-active' : ''}
            />
            <span className="form-hint">
              Find in DB: <code>SELECT id, name FROM organizations;</code>
            </span>
          </div>

          <div className="form-group">
            <label>Plan</label>
            <div className="plan-options">
              {['BASIC', 'PRO', 'MAX'].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`plan-option${plan === p ? ' selected' : ''}`}
                  onClick={() => handlePlanChange(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Editor Seats</label>
              <input
                type="number"
                min={1}
                max={100}
                value={seatsEditor}
                onChange={(e) => setSeatsEditor(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Player Seats</label>
              <input
                type="number"
                min={1}
                max={500}
                value={seatsPlayer}
                onChange={(e) => setSeatsPlayer(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Valid Until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create License'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
