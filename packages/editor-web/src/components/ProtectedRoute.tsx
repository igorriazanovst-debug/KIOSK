/**
 * ProtectedRoute Component
 * Защищает маршруты от неавторизованных пользователей
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../services/api-client';
import { logger } from '../utils/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = apiClient.isAuthenticated();

  if (!isAuthenticated) {
    logger.warn('Access denied - redirecting to login');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
