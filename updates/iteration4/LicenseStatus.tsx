// packages/editor/src/components/LicenseStatus.tsx
// License status display and management for Editor

import React, { useState, useEffect } from 'react';
import { LicenseService } from '../services/LicenseService';
import { PLAN_FEATURES } from '@kiosk/shared';
import './LicenseStatus.css';

interface LicenseStatusProps {
  onDeactivate?: () => void;
}

export const LicenseStatus: React.FC<LicenseStatusProps> = ({ onDeactivate }) => {
  const [status, setStatus] = useState(LicenseService.getLicenseStatus());
  const [token, setToken] = useState(LicenseService.getToken());
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Update status every minute
    const interval = setInterval(() => {
      setStatus(LicenseService.getLicenseStatus());
      setToken(LicenseService.getToken());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!token || !status) {
    return (
      <div className="license-status not-activated">
        <div className="status-header">
          <span className="status-icon">🔒</span>
          <h3>Not Activated</h3>
        </div>
        <p>This device is not activated. Please activate a license key to use the Editor.</p>
      </div>
    );
  }

  const plan = token.plan;
  const features = PLAN_FEATURES[plan];
  const expiresAt = new Date(token.expiresAt);
  const isExpiringSoon = status.expiresIn < 7;

  const handleDeactivate = async () => {
    setDeactivating(true);
    setError(null);

    try {
      // We need the license key to deactivate - in production you might store this or ask user
      const licenseKey = prompt('Enter license key to confirm deactivation:');
      if (!licenseKey) {
        setDeactivating(false);
        setShowDeactivateDialog(false);
        return;
      }

      await LicenseService.deactivate(licenseKey);
      setShowDeactivateDialog(false);
      onDeactivate?.();
    } catch (err: any) {
      setError(err.message || 'Deactivation failed');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className={`license-status ${status.isExpired ? 'expired' : 'active'}`}>
      {/* Status Header */}
      <div className="status-header">
        <div className="plan-badge" data-plan={plan.toLowerCase()}>
          <span className="plan-icon">
            {plan === 'BASIC' && '⭐'}
            {plan === 'PRO' && '🚀'}
            {plan === 'MAX' && '👑'}
          </span>
          <span className="plan-name">{plan} Plan</span>
        </div>
        
        {status.isExpired && (
          <span className="status-badge expired">Expired</span>
        )}
        {isExpiringSoon && !status.isExpired && (
          <span className="status-badge expiring">Expiring Soon</span>
        )}
        {!status.isExpired && !isExpiringSoon && (
          <span className="status-badge active">Active</span>
        )}
      </div>

      {/* Expiration Info */}
      <div className="expiration-info">
        <span className="label">Token Expires:</span>
        <span className="value">
          {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString()}
        </span>
        <span className="remaining">
          ({status.expiresIn} days remaining)
        </span>
      </div>

      {/* Device Info */}
      <div className="device-info-section">
        <h4>Device Information</h4>
        <div className="info-row">
          <span className="label">Device ID:</span>
          <code className="value">{token.deviceId}</code>
        </div>
        <div className="info-row">
          <span className="label">License ID:</span>
          <code className="value">{token.licenseId}</code>
        </div>
      </div>

      {/* Features List */}
      <div className="features-section">
        <h4>Available Features</h4>
        <div className="features-grid">
          <div className={`feature-item ${features.editPredefinedTemplates ? 'enabled' : 'disabled'}`}>
            <span className="feature-icon">
              {features.editPredefinedTemplates ? '✓' : '✗'}
            </span>
            <span className="feature-name">Edit Templates</span>
          </div>
          <div className={`feature-item ${features.createCustomTemplates ? 'enabled' : 'disabled'}`}>
            <span className="feature-icon">
              {features.createCustomTemplates ? '✓' : '✗'}
            </span>
            <span className="feature-name">Create Templates</span>
          </div>
          <div className={`feature-item ${features.advancedExport ? 'enabled' : 'disabled'}`}>
            <span className="feature-icon">
              {features.advancedExport ? '✓' : '✗'}
            </span>
            <span className="feature-name">Advanced Export</span>
          </div>
          <div className={`feature-item ${features.cloudStorage ? 'enabled' : 'disabled'}`}>
            <span className="feature-icon">
              {features.cloudStorage ? '✓' : '✗'}
            </span>
            <span className="feature-name">Cloud Storage</span>
          </div>
          <div className={`feature-item ${features.teamCollaboration ? 'enabled' : 'disabled'}`}>
            <span className="feature-icon">
              {features.teamCollaboration ? '✓' : '✗'}
            </span>
            <span className="feature-name">Team Collaboration</span>
          </div>
          <div className={`feature-item ${features.prioritySupport ? 'enabled' : 'disabled'}`}>
            <span className="feature-icon">
              {features.prioritySupport ? '✓' : '✗'}
            </span>
            <span className="feature-name">Priority Support</span>
          </div>
        </div>
      </div>

      {/* Seats Info */}
      <div className="seats-info">
        <div className="seats-item">
          <span className="seats-label">Editor Seats:</span>
          <span className="seats-value">{features.maxEditorDevices}</span>
        </div>
        <div className="seats-item">
          <span className="seats-label">Player Seats:</span>
          <span className="seats-value">{features.maxPlayerDevices}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="actions-section">
        <button
          className="btn btn-danger"
          onClick={() => setShowDeactivateDialog(true)}
        >
          Deactivate Device
        </button>
      </div>

      {/* Deactivate Dialog */}
      {showDeactivateDialog && (
        <div className="deactivate-dialog">
          <div className="dialog-content">
            <h3>⚠️ Deactivate Device?</h3>
            <p>
              Are you sure you want to deactivate this device? You will need to enter your
              license key again to reactivate.
            </p>
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}
            <div className="dialog-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeactivateDialog(false);
                  setError(null);
                }}
                disabled={deactivating}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
