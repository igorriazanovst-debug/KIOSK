import { CHIMIQ_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что rusiqAccess.ts/mathmachineAccess.ts и остальные —
// allow-list доступа к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с
// виджетом «ХимIQ» по email аккаунта редактора. Клиентское скрытие в
// WidgetLibrary.tsx (CHIMIQ_ALLOWED_EMAILS) уже было в Фазе 1 — этот файл
// закрывает серверную половину рубежа (тот же класс дыры, что нашли и
// закрыли для Тип2/Тип3: клиентское скрытие без серверной проверки).

const CHIMIQ_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForChimiq(email: string | undefined | null): boolean {
  if (!email) return false;
  return CHIMIQ_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasChimiqWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === CHIMIQ_WIDGET_TYPE
    )
  );
}
