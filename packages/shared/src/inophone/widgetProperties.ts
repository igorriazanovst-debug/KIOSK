// packages/shared/src/inophone/widgetProperties.ts
// Описание типа виджета «inophone» («Инофон», Тип 4) — формат поля
// widget.properties. Единственный источник: подключают и editor-web, и player.
//
// Как chronoline, natcom, mathmachine, periodictable, words и alphabet, это
// виджет-маркер standalone-приложения, а не прямоугольник на канвасе: рантайм
// занимает весь вьюпорт (Player.tsx, isStandaloneAppProject), а проект с таким
// виджетом собирается в оконном режиме (windowMode.js).
//
// ФАЙЛ НАМЕРЕННО ВНЕ пространства имён `inophone`: имена уникальны по пакету
// (все с префиксом INOPHONE_), а девять точек регистрации устроены как плоские
// импорты из '@kiosk/shared'. Домен же выходит пространством имён — там
// `Scene`, `Theme`, `Translation` совпадают по смыслу с чужими.

import type { LanguageCode } from './model/languages';
import {
  DEFAULT_INTERFACE_LANGUAGE,
  DEFAULT_STUDY_LANGUAGES,
  LANGUAGES,
  MAX_STUDY_LANGUAGES,
} from './model/languages';
import { MAX_PLAYERS } from './game/session';
import type { InophoneMode } from './game/session';

export const INOPHONE_WIDGET_TYPE = 'inophone' as const;

/**
 * Три режима ТЗ строки 89. Порядок значим: это последовательность от «просто
 * посмотреть» к «соревноваться», и в этом же порядке они стоят на экране.
 *
 * Тип режима игры берётся из домена, но здесь список ШИРЕ: обучение в движок
 * партии не входит (там нет ни счёта, ни хода), а на экране выбора оно есть.
 */
export type InophoneScreenMode = 'learning' | InophoneMode;
export const INOPHONE_MODES: readonly InophoneScreenMode[] = ['learning', 'training', 'challenge'];

export const INOPHONE_MODE_TITLES: Record<InophoneScreenMode, string> = {
  learning: 'Обучение',
  training: 'Тренировка',
  challenge: 'Соревнование',
};

/** Короткое пояснение режима — ровно то, что требует ТЗ строка 89 */
export const INOPHONE_MODE_HINTS: Record<InophoneScreenMode, string> = {
  learning: 'все объекты подсвечены',
  training: 'программа называет объект, ученик его находит',
  challenge: 'то же для двух и более игроков, в конце итоги',
};

// Константы ниже — ПСЕВДОНИМЫ доменных, а не вторые их копии: редактор и
// плеер ждут префикс INOPHONE_, домен живёт в пространстве имён. Пусть имён
// два, но значение одно.

export const INOPHONE_MAX_PLAYERS = MAX_PLAYERS;
export const INOPHONE_MAX_STUDY_LANGUAGES = MAX_STUDY_LANGUAGES;
export const INOPHONE_LANGUAGES = LANGUAGES;

/** Сколько вопросов в партии тренировки и соревнования */
export const INOPHONE_QUESTION_COUNTS: readonly number[] = [5, 10, 15, 20];
export const INOPHONE_DEFAULT_QUESTION_COUNT = 10;

export interface InophoneWidgetProperties {
  title?: string;
  /** Язык интерфейса и родной язык ученика (ТЗ строка 87) */
  interfaceLanguage: LanguageCode;
  /** Изучаемые языки, от одного до трёх (ТЗ строка 88) */
  studyLanguages: LanguageCode[];
  /** С какого режима открывается приложение */
  defaultMode: InophoneScreenMode;
  questionCount: number;
  /** Сколько игроков предлагать по умолчанию, 1..4 */
  defaultPlayerCount: number;
  volume: number;
}

export const INOPHONE_PROPS_VERSION = '1.0';

export const INOPHONE_DEFAULT_PROPS: InophoneWidgetProperties = {
  title: '',
  interfaceLanguage: DEFAULT_INTERFACE_LANGUAGE,
  studyLanguages: [...DEFAULT_STUDY_LANGUAGES],
  defaultMode: 'learning',
  questionCount: INOPHONE_DEFAULT_QUESTION_COUNT,
  defaultPlayerCount: 1,
  volume: 70,
};

/**
 * Размер по умолчанию на канвасе редактора.
 *
 * Сцены рисуются широкими (16:10), и заглушка виджета показывает именно их —
 * квадрат вводил бы педагога в заблуждение о том, как выглядит занятие.
 */
export const INOPHONE_DEFAULT_SIZE = { width: 1280, height: 800 } as const;
