import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
try {
    const root = document.getElementById('root');
    if (!root) {
        throw new Error('Root element not found');
    }
    ReactDOM.createRoot(root).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
}
catch (error) {
    console.error('Failed to mount React app:', error);
    // Показываем ошибку пользователю
    document.body.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #1e1e1e;
      color: #ff6b6b;
      font-family: Arial, sans-serif;
      padding: 20px;
    ">
      <div style="text-align: center; max-width: 600px;">
        <h1>❌ Ошибка загрузки редактора</h1>
        <p style="color: #cccccc;">Проверьте консоль браузера (F12) для деталей.</p>
        <pre style="
          text-align: left;
          background: #2a2a2a;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
          color: #ff6b6b;
        ">${error}</pre>
        <button onclick="location.reload()" style="
          margin-top: 20px;
          padding: 10px 20px;
          background: #4a90e2;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
        ">
          Перезагрузить страницу
        </button>
      </div>
    </div>
  `;
}
