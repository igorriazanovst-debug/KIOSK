/**
 * useActivityTimeout Hook
 * Отслеживает активность пользователя и вызывает callback при таймауте
 */

import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

interface UseActivityTimeoutOptions {
  timeout: number; // Таймаут в миллисекундах
  onTimeout: () => void; // Callback при таймауте
  events?: string[]; // События для отслеживания
}

export const useActivityTimeout = ({
  timeout,
  onTimeout,
  events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
}: UseActivityTimeoutOptions) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  /**
   * Сброс таймера активности
   */
  const resetTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Очистить предыдущий таймер
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Установить новый таймер
    timerRef.current = setTimeout(() => {
      const inactiveTime = Date.now() - lastActivityRef.current;
      logger.warn('User inactivity timeout', {
        inactiveTime,
        timeoutSetting: timeout
      });
      onTimeout();
    }, timeout);
  }, [timeout, onTimeout]);

  /**
   * Обработчик событий активности
   */
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Запустить таймер при монтировании
    resetTimer();

    // Добавить слушатели событий
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    logger.info('Activity timeout monitoring started', {
      timeout: timeout / 1000 / 60 + ' minutes',
      events
    });

    // Очистка при размонтировании
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });

      logger.info('Activity timeout monitoring stopped');
    };
  }, [events, handleActivity, resetTimer, timeout]);

  /**
   * Получить время последней активности
   */
  const getLastActivity = useCallback(() => {
    return lastActivityRef.current;
  }, []);

  /**
   * Получить время неактивности в миллисекундах
   */
  const getInactiveTime = useCallback(() => {
    return Date.now() - lastActivityRef.current;
  }, []);

  return {
    resetTimer,
    getLastActivity,
    getInactiveTime
  };
};
