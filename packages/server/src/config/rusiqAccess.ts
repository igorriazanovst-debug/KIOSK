// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts/mathmachineAccess.ts
// — allow-list доступа к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с
// виджетом «РусIQ» по email аккаунта редактора. По решению пользователя
// (2026-09-10, брейнсторминг Тип7), см.
// docs/superpowers/specs/2026-09-10-rusiq-widget-design.md.
//
// RUSIQ_WIDGET_TYPE объявлена локально, не импортирована из @kiosk/shared —
// тот же паттерн, что MATHMACHINE_WIDGET_TYPE в electron/chrono/windowMode.js.
const RUSIQ_WIDGET_TYPE = 'rusiq';

const RUSIQ_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForRusiq(email: string | undefined | null): boolean {
  if (!email) return false;
  return RUSIQ_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasRusiqWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === RUSIQ_WIDGET_TYPE
    )
  );
}
