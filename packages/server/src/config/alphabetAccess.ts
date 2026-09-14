import { ALPHABET_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts/mathmachineAccess.ts/
// periodicTableAccess.ts/rusiqAccess.ts/wordsAccess.ts — allow-list доступа к
// РЕДАКТИРОВАНИЮ (создание/сохранение) проекта с виджетом «АзбукоСлов» по
// email аккаунта редактора.
//
// Найдено при публикации (2026-09-14): виджет уже в `main` с клиентским
// скрытием в WidgetLibrary.tsx (ALPHABET_ALLOWED_EMAILS), но БЕЗ этого,
// серверного, рубежа — тот же класс дыры, что уже был найден и закрыт у
// «Я знаю много слов». Клиентское скрытие само по себе не мешает отправить
// POST/PUT /api/projects с этим виджетом напрямую через API в обход
// интерфейса редактора.

const ALPHABET_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForAlphabet(email: string | undefined | null): boolean {
  if (!email) return false;
  return ALPHABET_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasAlphabetWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === ALPHABET_WIDGET_TYPE
    )
  );
}
