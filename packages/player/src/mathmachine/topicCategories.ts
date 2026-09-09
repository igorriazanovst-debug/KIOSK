import type { MathMachineContent, GroupProgress } from '@kiosk/shared';
import { listTopics, listGroupsForTopic, summarizeGroupProgress, type FlatTopicRef } from '@kiosk/shared';

// Группировка 124+ тем каталога в разделы для экрана «Выбери тему» —
// решает проблему масштаба плоского списка карточек (см. Тип6_бэклог.md,
// Эпик 23, «побочное наблюдение»). Категория определяется по префиксу
// topicId, а не по названию — id темы стабилен между волнами контента,
// текст названия — нет. Порядок — примерная педагогическая
// последовательность: базовые числовые навыки раньше, комбинированные и
// продвинутые темы позже. top_addition_three* проверяется раньше
// top_addition*, иначе тема «Сумма трёх чисел» тихо попала бы в «Сложение».
export interface TopicCategoryDef {
  key: string;
  name: string;
  matchesTopicId: (topicId: string) => boolean;
}

function byPrefix(prefix: string): (topicId: string) => boolean {
  const id = `top_${prefix}`;
  return (topicId) => topicId === id || topicId.startsWith(`${id}_`);
}

export const TOPIC_CATEGORIES: TopicCategoryDef[] = [
  { key: 'counting', name: 'Счёт', matchesTopicId: byPrefix('counting') },
  { key: 'digits', name: 'Цифры', matchesTopicId: byPrefix('digits') },
  { key: 'composition', name: 'Состав числа', matchesTopicId: byPrefix('composition') },
  { key: 'addition_three', name: 'Сумма трёх чисел', matchesTopicId: byPrefix('addition_three') },
  { key: 'addition', name: 'Сложение', matchesTopicId: byPrefix('addition') },
  { key: 'subtraction', name: 'Вычитание', matchesTopicId: byPrefix('subtraction') },
  { key: 'comparison', name: 'Сравнение чисел', matchesTopicId: byPrefix('comparison') },
  { key: 'ordering', name: 'Порядок чисел', matchesTopicId: byPrefix('ordering') },
  { key: 'missing', name: 'Пропущенное число', matchesTopicId: byPrefix('missing') },
  { key: 'multiplication', name: 'Умножение', matchesTopicId: byPrefix('multiplication') },
  { key: 'division', name: 'Деление', matchesTopicId: byPrefix('division') },
  { key: 'multiples', name: 'Кратные', matchesTopicId: byPrefix('multiples') },
  { key: 'rounding', name: 'Оценки', matchesTopicId: byPrefix('rounding') },
  { key: 'ordinal', name: 'Порядковые числительные', matchesTopicId: byPrefix('ordinal') },
  { key: 'shares', name: 'Доли целого', matchesTopicId: byPrefix('shares') },
  // Этап 3 (2026-09-09) — Группа 1 покрытия FR-022 ТЗ (величины, время) —
  // см. Тип6_бэклог.md, Эпик 30.
  { key: 'measure', name: 'Величины', matchesTopicId: byPrefix('measure') },
  { key: 'time', name: 'Время', matchesTopicId: byPrefix('time') },
];

export function categorizeTopicId(topicId: string): TopicCategoryDef | undefined {
  return TOPIC_CATEGORIES.find((c) => c.matchesTopicId(topicId));
}

export interface TopicCategoryGroup {
  key: string;
  name: string;
  topics: FlatTopicRef[];
}

export function listTopicsByCategory(content: MathMachineContent): TopicCategoryGroup[] {
  const byKey = new Map<string, FlatTopicRef[]>();
  for (const topic of listTopics(content)) {
    const category = categorizeTopicId(topic.topicId);
    if (!category) continue;
    const list = byKey.get(category.key) ?? [];
    list.push(topic);
    byKey.set(category.key, list);
  }
  return TOPIC_CATEGORIES.map((c) => ({ key: c.key, name: c.name, topics: byKey.get(c.key) ?? [] })).filter(
    (g) => g.topics.length > 0
  );
}

// Тема считается завершённой, когда в ней закрыты ВСЕ группы — та же
// семантика, что уже использует CatalogScreen для пилюли прогресса
// отдельной темы, просто применённая ко всем группам темы разом.
export function isTopicComplete(
  content: MathMachineContent,
  progress: Record<string, GroupProgress>,
  topicId: string
): boolean {
  const groups = listGroupsForTopic(content, topicId);
  if (groups.length === 0) return false;
  return groups.every((group) => {
    const summary = summarizeGroupProgress(group, progress[group.id]);
    return summary.total > 0 && summary.doneCount === summary.total;
  });
}
