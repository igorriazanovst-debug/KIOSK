// packages/natcom-student-web/src/admin/LicenseSection.tsx
// Экран «Лицензия» (Тип5_бэклог.md, Эпик 10, T5-092; ТЗ FR-014 «отслеживание
// состояния лицензии»). Открытый вопрос №7 плана решён пользователем
// 2026-09-05: отдельный тариф «бессрочно» НЕ добавляется - у продукта
// используются только существующие тарифы KIOSK License.plan
// (Basic/Pro/Max) - поэтому здесь нет отдельной ветки "бессрочно", только
// обычные план/срок действия.
//
// Переиспользует уже существующий GET /api/license (Эпик 4, T5-030) - тот же
// эндпоинт, что уже отдаёт decode лицензионного JWT плеера; отдельного
// серверного кода для этого экрана не требуется.

import React, { useEffect, useState } from 'react';

interface LicenseInfo {
  available: boolean;
  plan?: string | null;
  organizationId?: string | null;
  expiresAt?: string | null;
}

const PLAN_LABELS: Record<string, string> = { basic: 'Basic', pro: 'Pro', max: 'Max' };

function formatPlan(plan: string | null | undefined): string {
  if (!plan) return 'не определён';
  return PLAN_LABELS[plan.toLowerCase()] || plan;
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) && ts < Date.now();
}

const LicenseSection: React.FC = () => {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/license')
      .then((resp) => resp.json())
      .then((body) => {
        if (!cancelled) setLicense(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="admin-app__error">Не удалось загрузить состояние лицензии: {error}</p>;
  }

  if (!license) return null;

  if (!license.available) {
    return <p className="admin-app__empty">Лицензия не активирована на этом устройстве.</p>;
  }

  const expired = isExpired(license.expiresAt);

  return (
    <div className="admin-app__license-card">
      <div className="admin-app__license-row">
        <span className="admin-app__license-label">Статус</span>
        <span className={expired ? 'admin-app__license-badge admin-app__license-badge--expired' : 'admin-app__license-badge admin-app__license-badge--active'}>
          {expired ? 'Истекла' : 'Активна'}
        </span>
      </div>
      <div className="admin-app__license-row">
        <span className="admin-app__license-label">Тариф</span>
        <span>{formatPlan(license.plan)}</span>
      </div>
      <div className="admin-app__license-row">
        <span className="admin-app__license-label">Организация</span>
        <span className="admin-app__license-mono">{license.organizationId || '—'}</span>
      </div>
      <div className="admin-app__license-row">
        <span className="admin-app__license-label">Действует до</span>
        <span>{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString('ru-RU') : 'не ограничено'}</span>
      </div>
    </div>
  );
};

export default LicenseSection;
