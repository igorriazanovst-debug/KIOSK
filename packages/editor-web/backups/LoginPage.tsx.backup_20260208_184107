/**
 * Login Page - Страница авторизации
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, AlertCircle, Loader } from 'lucide-react';
import { apiClient } from '../services/api-client';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Форматирование ключа лицензии (XXXX-XXXX-XXXX-XXXX)
  const formatLicenseKey = (value: string): string => {
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join('-').substring(0, 19);
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
      console.log('[LoginPage] Attempting login');
      const response = await apiClient.loginWithLicense(licenseKey);
      
      console.log('[LoginPage] Login successful, redirecting to /editor');
      
      // Успешный вход - редирект на редактор
      navigate('/editor', { replace: true });
      
    } catch (err: any) {
      console.error('[LoginPage] Login failed:', err);
      setError(err.message || 'Не удалось выполнить вход. Проверьте ключ лицензии.');
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
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <Key size={48} className="login-icon" />
          <h1>Kiosk Editor</h1>
          <p>Вход в систему</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
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
            className="login-button"
            disabled={isLoading || licenseKey.length < 19}
          >
            {isLoading ? (
              <>
                <Loader size={20} className="spinner" />
                <span>Вход...</span>
              </>
            ) : (
              <>
                <Key size={20} />
                <span>Войти</span>
              </>
            )}
          </button>
        </form>

        <div className="test-keys">
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
  );
};

export default LoginPage;
