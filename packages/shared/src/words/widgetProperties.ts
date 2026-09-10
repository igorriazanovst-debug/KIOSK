// packages/shared/src/words/widgetProperties.ts
// Описание типа виджета "words" («Я знаю много слов», Тип 2) — формат поля
// widget.properties. Единственный источник (editor-web И player подключают
// отсюда), тот же принцип, что у chrono/widgetProperties.ts и
// naturalCommunities/widgetProperties.ts.
//
// Как и у "chronoline"/"naturalcommunities", это виджет-маркер standalone-
// приложения, а не позиционируемый прямоугольник на канвасе: рантайм
// занимает весь вьюпорт (Player.tsx, isStandaloneAppProject), а проект с
// таким виджетом собирается в оконном режиме (windowMode.js,
// STANDALONE_APP_WIDGET_TYPES). Здесь — только внешний вид и поведение;
// учебный контент (слова, темы, озвучка) лежит в packages/words-library и
// едет в дистрибутив через extraResources, а пользовательские слова
// педагога — в локальном хранилище на устройстве.

/** Идентификатор типа виджета */
export const WORDS_WIDGET_TYPE = 'words' as const;

/** Уровень сложности вопроса. ТЗ строка 50 требует «≥ 3 уровня» */
export const WORDS_LEVELS = [0, 1, 2] as const;
export type WordsLevel = (typeof WORDS_LEVELS)[number];

/**
 * Специальный уровень пользовательского слова. У слова, добавленного
 * педагогом, нет фразовых вариантов озвучки (есть только его собственная
 * запись), поэтому сценарий реплик для него отдельный — тот же приём, что у
 * эталона ОС3 (level 9 / scenario9Say).
 */
export const WORDS_USER_LEVEL = 9 as const;

/** Максимум игроков за интерактивным столом (ТЗ строка 54: «для 2, 3 и 4 игроков») */
export const WORDS_MAX_PLAYERS = 4 as const;

/** Шагов партии на одного игрока по умолчанию (как у эталона) */
export const WORDS_DEFAULT_STEPS_PER_PLAYER = 20;

/** Вариантов ответа на шаге по умолчанию (загаданное слово + дистракторы) */
export const WORDS_DEFAULT_OPTIONS_PER_STEP = 4;

/** Что лежит в widget.properties у виджета «Я знаю много слов» */
export interface WordsWidgetProperties {
  /** Заголовок виджета (опционально, показывается в заглушке редактора) */
  title?: string;
  /**
   * Темы, доступные на занятии. Пустой массив — доступны все темы поставки.
   * Педагог сужает набор в редакторе; на устройстве это же можно поменять в
   * настройках занятия (ТЗ строка 48).
   */
  enabledThemeIds: string[];
  /** Уровень сложности по умолчанию для новой партии (ТЗ строка 50) */
  defaultLevel: WordsLevel;
  /** Сколько игроков предлагать по умолчанию, 1..4 (ТЗ строка 54) */
  defaultPlayerCount: number;
  /** Громкость 0..100 (ТЗ строка 51) */
  volume: number;
  /** Шагов на игрока в партии */
  stepsPerPlayer: number;
}

/** Версия формата свойств виджета (для будущих миграций) */
export const WORDS_PROPS_VERSION = '1.0';

/** Дефолтные свойства нового виджета «Я знаю много слов» */
export const WORDS_DEFAULT_PROPS: WordsWidgetProperties = {
  title: '',
  enabledThemeIds: [],
  defaultLevel: 0,
  defaultPlayerCount: 1,
  volume: 70,
  stepsPerPlayer: WORDS_DEFAULT_STEPS_PER_PLAYER,
};

/**
 * Дефолтные размеры на канвасе при добавлении виджета. Реального влияния на
 * рантайм не имеют (виджет занимает весь экран), но нужны, чтобы заглушка в
 * редакторе выглядела осмысленно — те же 1280×800, что у natcom.
 */
export const WORDS_DEFAULT_SIZE = {
  width: 1280,
  height: 800,
};
