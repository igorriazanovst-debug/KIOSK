import { WORDS_WIDGET_TYPE } from '@kiosk/shared';

// Тот же принцип, что chronolineAccess.ts/natcomAccess.ts/mathmachineAccess.ts/
// periodicTableAccess.ts/rusiqAccess.ts — allow-list доступа к РЕДАКТИРОВАНИЮ
// (создание/сохранение) проекта с виджетом «Я знаю много слов» по email
// аккаунта редактора.
//
// Найдено при публикации (2026-09-14): виджет уже несколько дней как в
// `main` с клиентским скрытием в WidgetLibrary.tsx (WORDS_ALLOWED_EMAILS),
// но БЕЗ этого, серверного, рубежа — единственный опубликованный виджет
// без него. Клиентское скрытие само по себе не мешает отправить
// POST/PUT /api/projects с этим виджетом напрямую через API в обход
// интерфейса редактора. Этот файл закрывает именно эту дыру, по прямому
// решению пользователя — не начинает и не трогает материализацию
// контента (Фаза 7), которая осталась открытым отдельным вопросом.

const WORDS_ALLOWED_EMAILS = ['mokretcov.m@poznaikino.ru'];

export function isEmailAllowedForWords(email: string | undefined | null): boolean {
  if (!email) return false;
  return WORDS_ALLOWED_EMAILS.includes(email.toLowerCase());
}

export function projectDataHasWordsWidget(projectData: unknown): boolean {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray((projectData as any).widgets) &&
    (projectData as any).widgets.some(
      (widget: any) => widget && typeof widget === 'object' && widget.type === WORDS_WIDGET_TYPE
    )
  );
}
