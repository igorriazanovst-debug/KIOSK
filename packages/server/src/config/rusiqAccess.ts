import { RUSIQ_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts/mathmachineAccess.ts
// — allow-list доступа к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с
// виджетом «РусIQ» по email аккаунта редактора. По решению пользователя
// (2026-09-10, брейнсторминг Тип7), см.
// docs/superpowers/specs/2026-09-10-rusiq-widget-design.md.
//
// RUSIQ_WIDGET_TYPE импортируется из @kiosk/shared, как MATHMACHINE_WIDGET_TYPE
// в mathmachineAccess.ts — этот файл TypeScript в packages/server, а не
// CommonJS-скрипт вроде electron/chrono/windowMode.js, поэтому локальный
// литерал здесь не оправдан (найдено финальным ревью ветки).

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
