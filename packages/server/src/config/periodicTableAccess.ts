import { PERIODICTABLE_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts/mathmachineAccess.ts/
// rusiqAccess.ts — allow-list доступа к РЕДАКТИРОВАНИЮ (создание/сохранение)
// проекта с виджетом «Таблица Менделеева» по email аккаунта редактора. По
// решению пользователя (2026-09-10, см.
// docs/superpowers/specs/2026-09-10-periodictable-widget-design.md).
const PERIODICTABLE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForPeriodicTable(email: string | undefined | null): boolean {
  if (!email) return false;
  return PERIODICTABLE_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasPeriodicTableWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === PERIODICTABLE_WIDGET_TYPE
    )
  );
}
