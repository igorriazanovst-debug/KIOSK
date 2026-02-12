/**
 * App Component - Главный компонент с роутингом
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Editor from './components/Editor';
import ProtectedRoute from './components/auth/ProtectedRoute';

const App: React.FC = () => {
  console.log('[App.tsx] App component rendering with Router');
  return (
    <BrowserRouter>
      <Routes>
        {/* Главная страница -> редирект на логин */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Страница входа */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Редактор (защищённый маршрут) */}
        <Route 
          path="/editor" 
          element={
            <ProtectedRoute>
              <Editor />
            </ProtectedRoute>
          } 
        />
        
        {/* Все остальные маршруты -> редирект на логин */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
