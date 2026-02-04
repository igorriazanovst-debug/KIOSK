/**
 * Login Dialog Component
 * Диалог входа по ключу лицензии
 */

import React, { useState } from 'react';
import { X, Key, AlertCircle, Loader } from 'lucide-react';
import { apiClient } from '../services/api-client';
import './LoginDialog.css';

interface LoginDialogProps {
  onClose: () => void;
  onSuccess: (orgName: string, plan: string) => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({ onClose, onSuccess }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Форматирование ключа лицензии (XXXX-XXXX-XXXX-XXXX)
  const formatLicenseKey = (value: string): string => {
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join('-').substring(0, 19); // Max 4 группы по 4 символа
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (licenseKey.length < 19) {
      setError('Введите полный ключ лицензии (16 символов)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[LoginDialog] Attempting login, timestamp:', Date.now());
      const response = await apiClient.loginWithLicense(licenseKey);
      
      console.log('[Auth] Login successful:', response);

      // Успешный вход
      console.log('[LoginDialog] Calling onSuccess, timestamp:', Date.now());
      onSuccess(
        response.license.organizationName || 'Organization',
        response.license.plan
      );
      onClose();

      onClose();

    } catch (err: any) {
      console.error('[Auth] Login failed:', err);
      setError(err.message || 'Не удалось выполнить вход. Проверьте ключ лицензии.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const formatted = formatLicenseKey(pasted);
    setLicenseKey(formatted);
  };

  return (
    <div className="login-dialog-overlay" onClick={onClose}>
      <div className="login-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="login-dialog-header">
          <div className="login-dialog-title">
            <Key size={24} />
            <h2>Вход в Kiosk Editor</h2>
          </div>
          <button className="close-btn" onClick={onClose} title="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="login-dialog-content">
          <p className="login-description">
            Введите ключ лицензии для доступа к редактору
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="licenseKey">Ключ лицензии</label>
              <input
                type="text"
                id="licenseKey"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={handleInputChange}
                onPaste={handlePaste}
                disabled={isLoading}
                autoFocus
                maxLength={19}
                className={error ? 'error' : ''}
              />
              <span className="input-hint">
                Формат: 4 группы по 4 символа
              </span>
            </div>

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-btn"
              disabled={isLoading || licenseKey.length < 19}
            >
              {isLoading ? (
                <>
                  <Loader size={18} className="spinner" />
                  <span>Вход...</span>
                </>
              ) : (
                <>
                  <Key size={18} />
                  <span>Войти</span>
                </>
              )}
            </button>
          </form>

          {/* Test keys hint */}
          <div className="test-keys-hint">
            <p>Тестовые ключи:</p>
            <ul>
              <li>
                <strong>BASIC:</strong> <code>EWZA-E5LJ-Z558-9LUQ</code>
              </li>
              <li>
                <strong>PRO:</strong> <code>3VBN-8ZQ9-1MKO-AK0R</code>
              </li>
              <li>
                <strong>MAX:</strong> <code>T8MH-FJE3-ETAC-YOZF</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginDialog;
