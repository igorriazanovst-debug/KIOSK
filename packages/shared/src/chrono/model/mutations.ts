// packages/shared/src/chrono/model/mutations.ts
// Чистые операции над ChronoProject — иммутабельно, без побочных эффектов
// (никакого fetch/IPC/crypto.randomUUID внутри): вызывающий код сам решает
// id и момент времени updatedAt, эти функции — только преобразование данных.
// Пригодится и editor-web в Фазе 7 (тот же принцип "один источник в
// packages/shared", что и у остального домена chrono).

import type { ChronoProject, ChronoTimeline, TimelineEvent } from './schema';

/** @param id Присваивается вызывающим кодом (например crypto.randomUUID()), не здесь */
export function addTimeline(project: ChronoProject, id: string, name: string): ChronoProject {
  const timeline: ChronoTimeline = { id, name, events: [], attributes: [], collapsed: false };
  return { ...project, timelines: [...project.timelines, timeline] };
}

export function renameTimeline(project: ChronoProject, timelineId: string, name: string): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) => (t.id === timelineId ? { ...t, name } : t)),
  };
}

export function deleteTimeline(project: ChronoProject, timelineId: string): ChronoProject {
  return { ...project, timelines: project.timelines.filter((t) => t.id !== timelineId) };
}

/** @param event Собран целиком вызывающим кодом (id, момент, view и т.д. уже решены) */
export function addEvent(project: ChronoProject, timelineId: string, event: TimelineEvent): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) => (t.id === timelineId ? { ...t, events: [...t.events, event] } : t)),
  };
}

/** Точечное обновление события (интервал, имя, атрибуты и т.п.) через частичный патч */
export function updateEvent(
  project: ChronoProject,
  timelineId: string,
  eventId: string,
  patch: Partial<TimelineEvent>
): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) =>
      t.id !== timelineId
        ? t
        : { ...t, events: t.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)) }
    ),
  };
}

export function deleteEvent(project: ChronoProject, timelineId: string, eventId: string): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) =>
      t.id !== timelineId ? t : { ...t, events: t.events.filter((e) => e.id !== eventId) }
    ),
  };
}
