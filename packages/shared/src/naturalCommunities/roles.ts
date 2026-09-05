// packages/shared/src/naturalCommunities/roles.ts
// Тип5_бэклог.md, T5-040: роль - атрибут сессии/токена (план, раздел 1.1),
// проверяемый на сервере при каждой мутирующей операции - не только
// скрытие кнопки в UI (тот же принцип, что allow-list Хронолайнера).
//
// Открытый вопрос №3 плана (доступен ли редактор роли «Ученик») ещё НЕ
// решён - hasAtLeastRole() сознательно не зависит от ответа: он просто
// сравнивает ранги, порог для каждой операции выбирает вызывающий код
// (Эпик 7+), когда решение будет принято.

export type NatComRole = 'student' | 'teacher' | 'admin';

const NATCOM_ROLE_RANK: Record<NatComRole, number> = {
  student: 1,
  teacher: 2,
  admin: 3,
};

/** true, если role не ниже minRole по иерархии student < teacher < admin. */
export function hasAtLeastRole(role: NatComRole, minRole: NatComRole): boolean {
  return NATCOM_ROLE_RANK[role] >= NATCOM_ROLE_RANK[minRole];
}
