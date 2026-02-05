/**
 * Protected Route - Защищённый маршрут
 * Проверяет авторизацию перед доступом к редактору
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../../services/api-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = apiClient.isAuthenticated();
  
  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
