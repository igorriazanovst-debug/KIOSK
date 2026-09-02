// packages/shared/src/chrono/model/mutations.ts
// Чистые операции над ChronoProject — иммутабельно, без побочных эффектов
// (никакого fetch/IPC/crypto.randomUUID внутри): вызывающий код сам решает
// id и момент времени updatedAt, эти функции — только преобразование данных.
// Пригодится и editor-web в Фазе 7 (тот же принцип "один источник в
// packages/shared", что и у остального домена chrono).

import type { ChronoProject, ChronoTimeline, TimelineEvent, ChronoMedia, AttributeDef } from './schema';

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

/** FR-034 ТЗ ("создание собственных стилей отображения линий") - пока один параметр стиля, акцентный цвет линии; undefined сбрасывает на цвет по умолчанию */
export function setTimelineColor(project: ChronoProject, timelineId: string, color: string | undefined): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) => (t.id === timelineId ? { ...t, color } : t)),
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

/**
 * Добавляет запись медиа в каталог проекта (project.media). Дедупликация
 * по sha256 - забота mediaStore.js (electron, копирование файла) на
 * уровне ФАЙЛА, здесь - на уровне КАТАЛОГА: importMedia на каждый вызов
 * генерирует новый случайный id, даже если файл с тем же содержимым уже
 * был импортирован раньше, поэтому если запись с таким sha256 уже есть в
 * project.media, новая НЕ добавляется - вместо этого возвращается УЖЕ
 * СУЩЕСТВУЮЩАЯ запись (с её собственным, другим id). Вызывающий код обязан
 * использовать media из результата (не тот объект, что передал на вход)
 * для event.mediaIds - иначе событие сослалось бы на id, которого в
 * project.media нет.
 */
export function addMedia(project: ChronoProject, media: ChronoMedia): { project: ChronoProject; media: ChronoMedia } {
  const existing = project.media.find((m) => m.sha256 === media.sha256);
  if (existing) return { project, media: existing };
  return { project: { ...project, media: [...project.media, media] }, media };
}

/** FR-035 ТЗ ("единое фоновое изображение хронолинии") - mediaId должен уже быть в project.media[] (через addMedia); null снимает фон */
export function setBackgroundMedia(project: ChronoProject, mediaId: string | null): ChronoProject {
  return { ...project, backgroundMediaId: mediaId };
}

/** @param attr Собран целиком вызывающим кодом (id, тип, enumValues при необходимости) */
export function addAttributeDef(project: ChronoProject, timelineId: string, attr: AttributeDef): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) => (t.id === timelineId ? { ...t, attributes: [...t.attributes, attr] } : t)),
  };
}

export function renameAttributeDef(project: ChronoProject, timelineId: string, attrId: string, name: string): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) =>
      t.id !== timelineId ? t : { ...t, attributes: t.attributes.map((a) => (a.id === attrId ? { ...a, name } : a)) }
    ),
  };
}

/**
 * Удаляет определение атрибута И его значения из ВСЕХ событий линии -
 * без второй части осталась бы висячая ссылка: attributeValues событий
 * продолжал бы содержать ключ, для которого больше нет определения (тот
 * же принцип целостности, что и у addMedia - не оставлять данные,
 * указывающие в никуда).
 */
export function deleteAttributeDef(project: ChronoProject, timelineId: string, attrId: string): ChronoProject {
  return {
    ...project,
    timelines: project.timelines.map((t) => {
      if (t.id !== timelineId) return t;
      return {
        ...t,
        attributes: t.attributes.filter((a) => a.id !== attrId),
        events: t.events.map((e) => {
          if (!(attrId in e.attributeValues)) return e;
          const { [attrId]: _removed, ...rest } = e.attributeValues;
          return { ...e, attributeValues: rest };
        }),
      };
    }),
  };
}
