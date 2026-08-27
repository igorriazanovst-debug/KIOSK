import React, { useEffect, useState, useCallback, useRef } from 'react';
import { adminApi, AdminProjectListItem, BuildArtifact, BuildPlatform, getApiBaseUrl, LicenseDetails } from '../services/adminApi';
import { LicenseUserAccounts } from './LicenseUserAccounts';
import './LicenseDetailModal.css';

interface LicenseDetailModalProps {
  token: string;
  licenseId: string;
  onClose: () => void;
}

const BUILD_POLL_INTERVAL_MS = 2000;
// Сборка реально идёт на сервере несколько минут (electron-builder) — один
// оборвавшийся запрос статуса (сетевой blip, "socket hang up" и т.п.) не
// должен показывать "Failed", пока сама сборка спокойно продолжается и
// завершается успешно. Сдаёмся только после нескольких подряд неудачных
// попыток опроса, а не после первой же.
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

export function LicenseDetailModal({ token, licenseId, onClose }: LicenseDetailModalProps) {
  const [license, setLicense] = useState<LicenseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seatsEditor, setSeatsEditor] = useState(0);
  const [seatsPlayer, setSeatsPlayer] = useState(0);
  const [savingSeats, setSavingSeats] = useState(false);

  const [catalog, setCatalog] = useState<AdminProjectListItem[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [pickedProjectId, setPickedProjectId] = useState('');
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [buildingProjectId, setBuildingProjectId] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [buildFiles, setBuildFiles] = useState<BuildArtifact[] | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [details, projects] = await Promise.all([
        adminApi.getLicenseById(token, licenseId),
        adminApi.listProjects(token)
      ]);
      setLicense(details);
      setSeatsEditor(details.seatsEditor);
      setSeatsPlayer(details.seatsPlayer);
      setCatalog(projects);
    } catch (err: any) {
      setError(err.message || 'Failed to load license');
    } finally {
      setLoading(false);
    }
  }, [token, licenseId]);

  useEffect(() => {
    load();
  }, [load]);

  // Каталог проектов отдаёт максимум 200 самых недавних (см. AdminController.listProjects) —
  // поиск по имени идёт на сервер, иначе проект вне top-200 недостижим из пикера.
  useEffect(() => {
    if (!projectSearch.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const projects = await adminApi.listProjects(token, projectSearch.trim());
        if (isMountedRef.current) setCatalog(projects);
      } catch {
        // молча оставляем текущий каталог — поиск не критичен для остального UI
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [projectSearch, token]);

  const handleSaveSeats = async () => {
    setSavingSeats(true);
    try {
      await adminApi.updateLicense(token, licenseId, { seatsEditor, seatsPlayer });
      await load();
    } catch (err: any) {
      alert('Failed to update seats: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingSeats(false);
    }
  };

  const handleGrant = async () => {
    if (!pickedProjectId) return;
    setGranting(true);
    try {
      await adminApi.grantProject(token, pickedProjectId, licenseId);
      setPickedProjectId('');
      await load();
    } catch (err: any) {
      alert('Failed to grant access: ' + (err.message || 'Unknown error'));
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (projectId: string) => {
    if (!confirm('Revoke access to this project?')) return;
    setRevokingId(projectId);
    try {
      await adminApi.revokeGrant(token, projectId, licenseId);
      await load();
    } catch (err: any) {
      alert('Failed to revoke access: ' + (err.message || 'Unknown error'));
    } finally {
      setRevokingId(null);
    }
  };

  const pollBuildStatus = useCallback((buildId: string) => {
    let consecutiveFailures = 0;
    const poll = async () => {
      if (!isMountedRef.current) return;
      try {
        const status = await adminApi.getBuildStatus(token, buildId);
        if (!isMountedRef.current) return;
        consecutiveFailures = 0;
        setBuildStatus(status.status === 'failed' ? `Failed: ${status.error || 'unknown error'}` : status.message || status.status);
        if (status.status === 'completed') {
          setBuildFiles(status.files && status.files.length > 0 ? status.files : null);
          setBuildingProjectId(null);
          return;
        }
        if (status.status === 'failed') {
          setBuildingProjectId(null);
          return;
        }
        setTimeout(poll, BUILD_POLL_INTERVAL_MS);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          setBuildStatus('Failed: ' + (err.message || 'unknown error'));
          setBuildingProjectId(null);
          return;
        }
        // Разовый сетевой сбой опроса — сборка на сервере продолжается, просто пробуем снова
        setTimeout(poll, BUILD_POLL_INTERVAL_MS);
      }
    };
    poll();
  }, [token]);

  const handleBuild = async (projectId: string, platform: BuildPlatform) => {
    setBuildingProjectId(projectId);
    setBuildStatus('Starting build...');
    setBuildFiles(null);
    try {
      const { build_id } = await adminApi.buildForLicense(token, licenseId, projectId, undefined, platform);
      pollBuildStatus(build_id);
    } catch (err: any) {
      setBuildStatus('Failed: ' + (err.message || 'Unknown error'));
      setBuildingProjectId(null);
    }
  };

  const grantedOrOwnedIds = new Set((license?.availableProjects || []).map(p => p.id));
  const grantableProjects = catalog.filter(p => !grantedOrOwnedIds.has(p.id));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>License details</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {loading && <div className="loading-cell">Loading...</div>}
          {error && <div className="form-error">{error}</div>}

          {license && !loading && (
            <>
              <div className="license-summary">
                <code>{license.licenseKey}</code>
                <span className="license-org">{license.organization?.name}</span>
              </div>

              <div className="detail-section">
                <h3>Client accounts</h3>
                <LicenseUserAccounts token={token} licenseId={licenseId} />
              </div>

              <div className="detail-section">
                <h3>Device seats</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Editor seats</label>
                    <input
                      type="number"
                      min={1}
                      value={seatsEditor}
                      onChange={(e) => setSeatsEditor(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Player seats</label>
                    <input
                      type="number"
                      min={1}
                      value={seatsPlayer}
                      onChange={(e) => setSeatsPlayer(Number(e.target.value))}
                    />
                  </div>
                  <button className="btn-secondary" disabled={savingSeats} onClick={handleSaveSeats}>
                    {savingSeats ? 'Saving...' : 'Save seats'}
                  </button>
                </div>
              </div>

              <div className="detail-section">
                <h3>Available projects</h3>
                <ul className="project-list">
                  {license.availableProjects.length === 0 && (
                    <li className="empty-cell">No projects yet</li>
                  )}
                  {license.availableProjects.map((p) => (
                    <li key={p.id} className="project-row">
                      <span className="project-name">{p.name}</span>
                      <span className={`access-badge access-${p.accessType}`}>
                        {p.accessType === 'own' ? 'Own' : 'Granted'}
                      </span>
                      <div className="build-buttons">
                        <button
                          className="btn-secondary btn-small"
                          disabled={buildingProjectId === p.id}
                          onClick={() => handleBuild(p.id, 'win')}
                        >
                          {buildingProjectId === p.id ? 'Building...' : 'Build .exe'}
                        </button>
                        <button
                          className="btn-secondary btn-small"
                          disabled={buildingProjectId === p.id}
                          onClick={() => handleBuild(p.id, 'deb')}
                        >
                          {buildingProjectId === p.id ? 'Building...' : 'Build .deb'}
                        </button>
                        <button
                          className="btn-secondary btn-small"
                          disabled={buildingProjectId === p.id}
                          onClick={() => handleBuild(p.id, 'rpm')}
                        >
                          {buildingProjectId === p.id ? 'Building...' : 'Build .rpm'}
                        </button>
                      </div>
                      {p.accessType === 'granted' && (
                        <button
                          className="btn-danger btn-small"
                          disabled={revokingId === p.id}
                          onClick={() => handleRevoke(p.id)}
                        >
                          {revokingId === p.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {(buildingProjectId || buildStatus) && (
                  <div className="build-status">
                    {buildStatus}
                    {buildFiles && buildFiles.map((f) => (
                      <a
                        key={f.download_url}
                        href={`${getApiBaseUrl()}${f.download_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="build-download-link"
                      >
                        Download {f.label} ({f.file_size})
                      </a>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  className="project-search-input"
                  placeholder="Search projects by name (beyond the 200 most recent)..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
                <div className="grant-picker">
                  <select value={pickedProjectId} onChange={(e) => setPickedProjectId(e.target.value)}>
                    <option value="">Select a project to grant access...</option>
                    {grantableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.license?.organization?.name ? ` — ${p.license.organization.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary btn-small" disabled={!pickedProjectId || granting} onClick={handleGrant}>
                    {granting ? 'Granting...' : 'Grant access'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
