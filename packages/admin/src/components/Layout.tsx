import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import './Layout.css';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/licenses', label: 'Licenses', icon: '🔐' },
  { to: '/devices', label: 'Devices', icon: '🖥️' },
  { to: '/audit', label: 'Audit Logs', icon: '📋' },
  { to: '/clients', label: 'Clients', icon: '👥' },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">🏢</span>
          <span className="sidebar-title">Kiosk Admin</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              end={item.to === '/'}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-avatar">{user?.email?.[0]?.toUpperCase() || '?'}</span>
            <div className="user-details">
              <span className="user-email">{user?.email}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="header">
          <div className="header-left">
            <h1 className="page-title" id="page-title">Dashboard</h1>
          </div>
          <div className="header-right">
            <span className="server-status online">● Server Online</span>
          </div>
        </header>

        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
