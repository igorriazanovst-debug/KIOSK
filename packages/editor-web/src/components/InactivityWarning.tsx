/**
 * InactivityWarning Component
 * Показывает предупреждение за 2 минуты до выхода по неактивности
 */

import React, { useState, useEffect } from 'react';
import './InactivityWarning.css';

export const InactivityWarning: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 минуты

  useEffect(() => {
    const handleWarning = () => {
      setVisible(true);
      setCountdown(120);
    };

    const handleLogout = () => {
      setVisible(false);
    };

    // Любая активность скрывает предупреждение
    const handleActivity = () => {
      if (visible) {
        setVisible(false);
      }
    };

    window.addEventListener('auth:inactivity-warning', handleWarning);
    window.addEventListener('auth:logout', handleLogout);
    
    // События активности
    const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      window.removeEventListener('auth:inactivity-warning', handleWarning);
      window.removeEventListener('auth:logout', handleLogout);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [visible]);

  // Обратный отсчёт
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="inactivity-warning-overlay">
      <div className="inactivity-warning">
        <div className="warning-icon">⏱️</div>
        <h3>Сессия скоро истечёт</h3>
        <p>
          Вы будете автоматически выведены из системы через{' '}
          <strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong>
        </p>
        <p className="hint">
          Нажмите любую клавишу или кликните мышью, чтобы продолжить работу
        </p>
        <button
          className="continue-btn"
          onClick={() => setVisible(false)}
        >
          Продолжить работу
        </button>
      </div>
    </div>
  );
};

export default InactivityWarning;
