// packages/server/src/config/chronolineAccess.ts
import { CHRONOLINE_WIDGET_TYPE } from '@kiosk/shared';

// Временный (не завязанный на тарифный план) allow-list доступа к виджету
// «Хронолиния» по email аккаунта редактора. Пока фича обкатывается только
// с одним реальным пользователем — см. Хронолайнер_создание_проекта.md.
// Список расширит пользователь, когда назовёт другие аккаунты.
const CHRONOLINE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForChronoline(email: string | undefined | null): boolean {
  if (!email) return false;
  return CHRONOLINE_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasChronolineWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === CHRONOLINE_WIDGET_TYPE
    )
  );
}
