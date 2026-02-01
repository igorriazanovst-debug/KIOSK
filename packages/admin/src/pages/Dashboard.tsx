import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { adminApi, Stats, AuditLog, License } from '../services/adminApi';
import { StatCard } from '../components/StatCard';
import { PlanChart } from '../components/PlanChart';
import { ActivityFeed } from '../components/ActivityFeed';
import './Dashboard.css';

export function Dashboard() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchAll();
  }, [token]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, logsRes, licensesRes] = await Promise.all([
        adminApi.getStats(token!),
        adminApi.getAuditLogs(token!, { page: 1, limit: 10 }),
        adminApi.getLicenses(token!, { page: 1, limit: 100 }),
      ]);
      setStats(statsRes);
      setRecentLogs(logsRes.logs);
      setLicenses(licensesRes.licenses);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard loading-state">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard error-state">
        <div className="error-box">
          <p>⚠️ {error}</p>
          <button onClick={fetchAll}>Retry</button>
        </div>
      </div>
    );
  }

  // Compute plan distribution for chart
  const planDistribution = licenses.reduce(
    (acc, l) => {
      acc[l.plan] = (acc[l.plan] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Status distribution
  const statusDistribution = licenses.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="dashboard">
      {/* Stat Cards Row */}
      <section className="stats-row">
        <StatCard
          title="Total Licenses"
          value={stats?.totalLicenses ?? 0}
          sub={`${stats?.activeLicenses ?? 0} active`}
          icon="🔐"
          color="blue"
        />
        <StatCard
          title="Total Devices"
          value={stats?.totalDevices ?? 0}
          sub={`${stats?.activeDevices ?? 0} online`}
          icon="🖥️"
          color="green"
        />
        <StatCard
          title="Editor Devices"
          value={stats?.editorDevices ?? 0}
          sub="activated editors"
          icon="✏️"
          color="purple"
        />
        <StatCard
          title="Player Devices"
          value={stats?.playerDevices ?? 0}
          sub="activated players"
          icon="▶️"
          color="orange"
        />
      </section>

      {/* Charts + Activity Row */}
      <section className="charts-row">
        <div className="chart-block">
          <h2 className="section-title">License Plans</h2>
          <PlanChart distribution={planDistribution} />
        </div>

        <div className="chart-block">
          <h2 className="section-title">License Status</h2>
          <PlanChart distribution={statusDistribution} colorMap={{ ACTIVE: '#22c55e', SUSPENDED: '#f59e0b', EXPIRED: '#ef4444', CANCELLED: '#6b7280' }} />
        </div>

        <div className="activity-block">
          <h2 className="section-title">Recent Activity</h2>
          <ActivityFeed logs={recentLogs} />
        </div>
      </section>
    </div>
  );
}
