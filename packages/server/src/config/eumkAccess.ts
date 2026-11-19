import { EUMK_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что physastroiqAccess.ts и остальные: allow-list доступа
// к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с виджетом «ЭУМК» по email
// аккаунта. Клиентское скрытие в WidgetLibrary.tsx (EUMK_ALLOWED_EMAILS) -
// только половина рубежа; эта серверная проверка - вторая.

// Allow-list доступа к ЭУМК-проектам по email. Расширяется через env
// (запятая): EUMK_ALLOWED_EMAILS=a@x.ru,b@x.ru — для аккаунтов поставки
// (Калининград: kaliningrad@kiosk.local) без правки кода.
const EUMK_ALLOWED_EMAILS = (process.env.EUMK_ALLOWED_EMAILS || 'admin@kiosk.local')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isEmailAllowedForEumk(email: string | undefined | null): boolean {
  if (!email) return false;
  return EUMK_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasEumkWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === EUMK_WIDGET_TYPE
    )
  );
}
