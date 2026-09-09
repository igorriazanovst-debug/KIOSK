import { MATHMACHINE_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts — allow-list
// доступа к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с виджетом
// «Матемашка» по email аккаунта редактора. По решению пользователя
// (2026-09-07, см. docs/superpowers/specs/2026-09-07-mathmachine-widget-design.md).
const MATHMACHINE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForMathMachine(email: string | undefined | null): boolean {
  if (!email) return false;
  return MATHMACHINE_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasMathMachineWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === MATHMACHINE_WIDGET_TYPE
    )
  );
}
