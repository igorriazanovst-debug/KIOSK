// packages/server/src/config/natcomAccess.ts
import { NATCOM_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts — allow-list доступа к
// РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с виджетом «Конструктор
// природных сообществ» по email аккаунта редактора, не по лицензии/
// организации: даже другие LicenseUser той же лицензии, что и разрешённый
// email, editor-доступа к этому виджету не получают. По прямому решению
// пользователя (2026-09-07).
const NATCOM_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForNatcom(email: string | undefined | null): boolean {
  if (!email) return false;
  return NATCOM_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasNatcomWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === NATCOM_WIDGET_TYPE
    )
  );
}
