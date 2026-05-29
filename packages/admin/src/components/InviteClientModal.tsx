import React, { useState } from 'react';
import './CreateLicenseModal.css';

interface InviteClientModalProps {
  onSubmit: (data: { email: string; plan: string; organizationName: string; validUntil: string }) => Promise<void>;
  onClose: () => void;
}

export function InviteClientModal({ onSubmit, onClose }: InviteClientModalProps) {
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [plan, setPlan] = useState('PRO');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !orgName.trim()) {
      setError('Email and organization name are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ email: email.trim(), plan, organizationName: orgName.trim(), validUntil });
    } catch (err: any) {
      setError(err.message || 'Failed to invite client');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invite Client</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="client@company.com" required />
          </div>
          <div className="form-group">
            <label>Organization Name</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              placeholder="Company Ltd." required />
          </div>
          <div className="form-group">
            <label>Plan</label>
            <div className="plan-options">
              {['BASIC', 'PRO', 'MAX'].map((p) => (
                <button key={p} type="button"
                  className={`plan-option${plan === p ? ' selected' : ''}`}
                  onClick={() => setPlan(p)}>{p}</button>
              ))}
            </div>
            <span className="form-hint">
              BASIC: 2 editors / 1 player &nbsp;|&nbsp;
              PRO: 4 / 10 &nbsp;|&nbsp;
              MAX: 8 / 25
            </span>
          </div>
          <div className="form-group">
            <label>Valid Until</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
              min={new Date().toISOString().split('T')[0]} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create & Get Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
