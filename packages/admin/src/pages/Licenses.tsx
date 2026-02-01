import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { adminApi, License } from '../services/adminApi';
import { CreateLicenseModal } from '../components/CreateLicenseModal';
import { Badge } from '../components/Badge';
import './Licenses.css';

export function Licenses() {
  const { token } = useAuthStore();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const LIMIT = 15;

  const fetchLicenses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.getLicenses(token, params);
      setLicenses(res.licenses);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Fetch licenses error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, statusFilter]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleCreate = async (data: {
    organizationId: string;
    plan: string;
    seatsEditor: number;
    seatsPlayer: number;
    validUntil: string;
  }) => {
    try {
      await adminApi.createLicense(token!, data);
      setShowCreateModal(false);
      fetchLicenses();
    } catch (err: any) {
      alert('Create failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await adminApi.updateLicense(token!, id, { status: newStatus });
      await fetchLicenses();
    } catch (err: any) {
      alert('Update failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="licenses-page">
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="search-input"
            placeholder="Search licenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create License
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="licenses-table">
          <thead>
            <tr>
              <th>License Key</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Seats (Ed / Pl)</th>
              <th>Valid Until</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="loading-cell">Loading...</td>
              </tr>
            ) : licenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">No licenses found</td>
              </tr>
            ) : (
              licenses.map((lic) => (
                <tr key={lic.id}>
                  <td className="key-cell">
                    <code>{lic.licenseKey}</code>
                  </td>
                  <td>
                    <Badge type="plan" value={lic.plan} />
                  </td>
                  <td>
                    <Badge type="status" value={lic.status} />
                  </td>
                  <td className="seats-cell">
                    {lic.seatsEditor} / {lic.seatsPlayer}
                  </td>
                  <td>{formatDate(lic.validUntil)}</td>
                  <td>{formatDate(lic.createdAt)}</td>
                  <td className="actions-cell">
                    <select
                      className="status-select"
                      value={lic.status}
                      disabled={updatingId === lic.id}
                      onChange={(e) => handleStatusChange(lic.id, e.target.value)}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspend</option>
                      <option value="EXPIRED">Expire</option>
                      <option value="CANCELLED">Cancel</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="page-info">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateLicenseModal onSubmit={handleCreate} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
