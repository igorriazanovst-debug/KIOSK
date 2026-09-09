// Обход дерева каталога Раздел → Тема → Группа → Задание (спека, разд. 5) и
// расчёт прогресса группы для статус-бара.

import type { MathMachineContent, Group, Task, GroupProgress } from './model/schema';

export interface FlatTopicRef {
  sectionId: string;
  sectionName: string;
  topicId: string;
  topicName: string;
}

export function listTopics(content: MathMachineContent): FlatTopicRef[] {
  const out: FlatTopicRef[] = [];
  for (const section of content.sections) {
    for (const topicId of section.topicIds) {
      const topic = content.topics[topicId];
      if (!topic) continue;
      out.push({ sectionId: section.id, sectionName: section.name, topicId: topic.id, topicName: topic.name });
    }
  }
  return out;
}

export function listGroupsForTopic(content: MathMachineContent, topicId: string): Group[] {
  const topic = content.topics[topicId];
  if (!topic) return [];
  return topic.groupIds.map((id) => content.groups[id]).filter((g): g is Group => !!g);
}

export function tasksForGroup(content: MathMachineContent, groupId: string): Task[] {
  const group = content.groups[groupId];
  if (!group) return [];
  return group.taskIds.map((id) => content.tasks[id]).filter((t): t is Task => !!t);
}

export function nextUndoneTaskId(group: Group, progress: GroupProgress | undefined): string | null {
  const done = new Set(progress?.doneTaskIds ?? []);
  for (const taskId of group.taskIds) {
    if (!done.has(taskId)) return taskId;
  }
  return null;
}

export interface GroupProgressSummary {
  total: number;
  doneCount: number;
  currentIndex: number;
}

export function summarizeGroupProgress(group: Group, progress: GroupProgress | undefined): GroupProgressSummary {
  const done = new Set(progress?.doneTaskIds ?? []);
  const doneCount = group.taskIds.filter((id) => done.has(id)).length;
  const idx = progress?.currentTaskId ? group.taskIds.indexOf(progress.currentTaskId) : doneCount;
  return { total: group.taskIds.length, doneCount, currentIndex: idx < 0 ? doneCount : idx };
}
