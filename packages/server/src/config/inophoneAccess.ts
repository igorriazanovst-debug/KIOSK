import { INOPHONE_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chimiqAccess.ts/rusiqAccess.ts и остальные — allow-list
// доступа к РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с виджетом
// «Инофон» по email аккаунта редактора. Клиентское скрытие в
// WidgetLibrary.tsx (INOPHONE_ALLOWED_EMAILS) уже было при регистрации
// виджета (коммит 8a32d680) - этот файл закрывает серверную половину
// рубежа (тот же класс дыры, что нашли и закрыли для Тип2/Тип3/РусIQ/
// ХимIQ: клиентское скрытие без серверной проверки — до этого файла
// packages/server не содержал НИ ОДНОГО упоминания "inophone").

const INOPHONE_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForInophone(email: string | undefined | null): boolean {
  if (!email) return false;
  return INOPHONE_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasInophoneWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === INOPHONE_WIDGET_TYPE
    )
  );
}
