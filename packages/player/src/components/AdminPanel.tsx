// Панель администратора (K2-F9): переключатель автозапуска после загрузки ОС.
// Доступ защищён тем же паролем, что и обновление (verifyUpdatePassword) -
// на киоске настройка не должна быть доступна без пароля. Вызывается по
// маленькой шестерёнке в углу; IPC-канал autostart:get/set существует с K2,
// до сих пор не имел вызовов из интерфейса.
import React, { useEffect, useState } from 'react';

interface AutostartState {
  enabled: boolean;
  supported: boolean;
  path?: string;
}

const gearStyle: React.CSSProperties = {
  position: 'fixed', bottom: 12, left: 12,
  width: 30, height: 30, borderRadius: 6,
  background: 'rgba(15,23,42,0.35)', color: 'rgba(255,255,255,0.55)',
  border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1,
  zIndex: 99990,
};

export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<AutostartState | null>(null);

  useEffect(() => {
    if (!verified) return;
    let alive = true;
    window.electronAPI?.getAutostart().then((s) => { if (alive) setState(s as AutostartState); });
    return () => { alive = false; };
  }, [verified]);

  const verify = async () => {
    if (!password.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const r = await window.electronAPI!.verifyUpdatePassword(password);
      if (r.success) setVerified(true);
      else setError(r.error || 'Неверный пароль');
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (!state || busy) return;
    setBusy(true); setError('');
    try {
      const r = await window.electronAPI!.setAutostart(!state.enabled);
      if (r.ok && typeof r.enabled === 'boolean') setState({ ...state, enabled: r.enabled });
      else setError(r.error || 'Не удалось изменить настройку');
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false); setVerified(false); setPassword(''); setError(''); setState(null);
  };

  return (
    <>
      <button type="button" title="Настройки администратора" style={gearStyle} onClick={() => setOpen(true)}>⚙</button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, fontFamily: 'Arial, sans-serif' }}
             onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div style={{ background: '#1e293b', borderRadius: 12, padding: '28px 32px', width: 380, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', color: '#f1f5f9' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Настройки администратора</h3>
            {!verified ? (
              <>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 12px' }}>Введите пароль администратора</p>
                <input type="password" autoFocus value={password} disabled={busy}
                       onChange={(e) => setPassword(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && void verify()}
                       placeholder="Пароль"
                       style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: '#0f172a', border: `2px solid ${error ? '#ef4444' : '#334155'}`, borderRadius: 8, color: '#f1f5f9', fontSize: 15, outline: 'none' }} />
                {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={close} style={btnGhost}>Закрыть</button>
                  <button type="button" disabled={busy || !password.trim()} onClick={() => void verify()} style={btnPrimary}>Войти</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '8px 0 4px' }}>
                  <div>
                    <div style={{ fontSize: 15 }}>Автозапуск после входа в ОС</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                      {state === null ? 'Чтение настройки…' : !state.supported ? 'Не поддерживается на этой системе' : state.enabled ? 'Включён' : 'Выключен'}
                    </div>
                  </div>
                  <button type="button" role="switch" aria-checked={state?.enabled ?? false}
                          disabled={busy || !state?.supported} onClick={() => void toggle()}
                          style={{
                            width: 52, height: 28, borderRadius: 14, border: 'none', cursor: state?.supported ? 'pointer' : 'default',
                            background: state?.enabled ? '#22c55e' : '#475569', position: 'relative', transition: 'background .2s',
                          }}>
                    <span style={{ position: 'absolute', top: 3, left: state?.enabled ? 27 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left .2s' }} />
                  </button>
                </div>
                {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
                {state?.path && <p style={{ color: '#64748b', fontSize: 11, margin: '8px 0 0', wordBreak: 'break-all' }}>{state.path}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" onClick={close} style={btnPrimary}>Готово</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const btnBase: React.CSSProperties = { border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 'bold', cursor: 'pointer', fontSize: 13 };
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#3b82f6', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'transparent', color: '#94a3b8', border: '1px solid #475569' };
