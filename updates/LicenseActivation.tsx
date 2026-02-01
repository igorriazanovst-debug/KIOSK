// packages/editor/src/components/LicenseActivation.tsx
// License activation dialog for Editor

import React, { useState } from 'react';
import { LicenseService } from '../services/LicenseService';
import './LicenseActivation.css';

interface LicenseActivationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const LicenseActivation: React.FC<LicenseActivationProps> = ({
  onSuccess,
  onCancel
}) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await LicenseService.activate(
        licenseKey.trim(),
        deviceName.trim() || undefined
      );

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    
    // Auto-format as XXXX-XXXX-XXXX-XXXX
    value = value.replace(/-/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    
    const formatted = value.match(/.{1,4}/g)?.join('-') || value;
    setLicenseKey(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleActivate();
    }
  };

  if (success) {
    return (
      <div className="license-activation">
        <div className="license-activation-modal">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>License Activated!</h2>
            <p>Your device has been successfully activated.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="license-activation">
      <div className="license-activation-modal">
        <h2>🔑 Activate License</h2>
        <p className="subtitle">
          Enter your license key to activate the Editor on this device.
        </p>

        <div className="form-group">
          <label htmlFor="license-key">License Key</label>
          <input
            id="license-key"
            type="text"
            value={licenseKey}
            onChange={handleKeyChange}
            onKeyDown={handleKeyDown}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            maxLength={19}
            disabled={loading}
            autoFocus
          />
          <span className="input-hint">
            Format: XXXX-XXXX-XXXX-XXXX (16 characters)
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="device-name">Device Name (Optional)</label>
          <input
            id="device-name"
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="My Editor PC"
            disabled={loading}
          />
          <span className="input-hint">
            Choose a name to identify this device
          </span>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="device-info">
          <span className="info-label">Device ID:</span>
          <code className="device-id">{LicenseService.getDeviceId()}</code>
        </div>

        <div className="button-group">
          {onCancel && (
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleActivate}
            disabled={loading || !licenseKey.trim()}
          >
            {loading ? 'Activating...' : 'Activate'}
          </button>
        </div>

        <div className="help-text">
          <p>Don't have a license key?</p>
          <p>Contact your administrator or visit our website to purchase.</p>
        </div>
      </div>
    </div>
  );
};
