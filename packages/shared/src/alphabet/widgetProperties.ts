// packages/shared/src/alphabet/widgetProperties.ts
// Описание типа виджета «alphabet» («АзбукоСлов», Тип 3) — формат поля
// widget.properties. Единственный источник: подключают и editor-web, и player.
//
// Как chronoline, naturalcommunities, mathmachine, periodictable и words, это
// виджет-маркер standalone-приложения, а не прямоугольник на канвасе: рантайм
// занимает весь вьюпорт (Player.tsx, isStandaloneAppProject), а проект с таким
// виджетом собирается в оконном режиме (windowMode.js,
// STANDALONE_APP_WIDGET_TYPES).
//
// ЭТОТ ФАЙЛ НАМЕРЕННО ВНЕ пространства имён `alphabet`: его имена уникальны по
// пакету (все с префиксом ALPHABET_), а точки регистрации виджета в редакторе
// и плеере устроены как плоские импорты из '@kiosk/shared' — заставлять их
// одних ходить через пространство имён значило бы сделать девять точек
// регистрации непохожими друг на друга ради ничего. Домен же (schema, graph,
// resources, движки) выходит пространством имён, потому что там четырнадцать
// имён совпадают с виджетом «слов»; см. комментарий в alphabet/index.ts.

import type { AlphabetStage } from './game/session';
import { MAX_PLAYERS } from './game/session';
import { SYLLABLE_OPTIONS } from './game/wordCompleting';
import { QUESTION_COUNTS, DEFAULT_ALPHABET_SETTINGS } from './model/schema';

/** Идентификатор типа виджета */
export const ALPHABET_WIDGET_TYPE = 'alphabet' as const;

/**
 * Три этапа обучения — ТЗ строка 65 («начальные навыки чтения») и строки
 * 73–74. Порядок значим: это последовательность от буквы к слову, её же
 * показывает экран выбора этапа (у эталона подписан «М / МА / МАМА»).
 *
 * Тип берётся из домена, а не объявляется заново: два имени для одного
 * перечисления неизбежно разъезжаются, а список этапов — как раз то, что
 * будут править, если этап когда-нибудь добавится.
 */
export type { AlphabetStage };
export const ALPHABET_STAGES: readonly AlphabetStage[] = [
  'letterShow',
  'wordCompleting',
  'wordMake',
];

/** Подписи этапов для интерфейса — здесь, чтобы не разъехались по экранам */
export const ALPHABET_STAGE_TITLES: Record<AlphabetStage, string> = {
  letterShow: 'Покажи букву',
  wordCompleting: 'Закончи слово',
  wordMake: 'Составь слово',
};

/** Короткая подпись этапа, как у эталона: М → МА → МАМА */
export const ALPHABET_STAGE_HINTS: Record<AlphabetStage, string> = {
  letterShow: 'М',
  wordCompleting: 'МА',
  wordMake: 'МАМА',
};

// Числовые константы ниже — ПСЕВДОНИМЫ доменных, а не вторые их копии.
// Редактор и плеер импортируют из '@kiosk/shared' плоско и ждут префикс
// ALPHABET_; домен живёт в пространстве имён. Пусть имён будет два, но
// значение — одно: разъехавшиеся «8 вариантов» в движке и «8 вариантов» в
// свойствах виджета отловить потом крайне трудно.

/** Максимум игроков за интерактивным столом (ТЗ строка 75: «для 2, 3 и 4 игроков») */
export const ALPHABET_MAX_PLAYERS = MAX_PLAYERS;

/** Вариантов на панели — восемь на всех трёх этапах, подтверждено снимками эталона */
export const ALPHABET_OPTIONS_PER_QUESTION = SYLLABLE_OPTIONS;

/**
 * Число вопросов в партии: у эталона это отдельный экран настройки.
 * Тип намеренно шире доменного (`readonly number[]`, а не кортеж литералов):
 * список тут перебирают кнопками экрана, где значение — обычное число.
 * Узкую проверку делает parseAlphabetSettings на границе записи.
 */
export const ALPHABET_QUESTION_COUNTS: readonly number[] = QUESTION_COUNTS;
export const ALPHABET_DEFAULT_QUESTION_COUNT = DEFAULT_ALPHABET_SETTINGS.questionCount;

/** Что лежит в widget.properties у виджета «АзбукоСлов» */
export interface AlphabetWidgetProperties {
  /** Заголовок (опционально, показывается в заглушке редактора) */
  title?: string;
  /**
   * Комплекты слов, доступные на занятии. Пустой массив — доступен весь
   * поставочный набор. Педагог сужает набор в редакторе; на устройстве то же
   * самое доступно в разделе своих слов (ТЗ строка 76).
   */
  enabledSetIds: string[];
  /** С какого этапа открывается приложение */
  defaultStage: AlphabetStage;
  /** Вопросов в партии */
  questionCount: number;
  /** Сколько игроков предлагать по умолчанию, 1..4 (ТЗ строка 75) */
  defaultPlayerCount: number;
  /** Громкость 0..100 */
  volume: number;
}

/** Версия формата свойств виджета (для будущих миграций) */
export const ALPHABET_PROPS_VERSION = '1.0';

export const ALPHABET_DEFAULT_PROPS: AlphabetWidgetProperties = {
  title: '',
  enabledSetIds: [],
  defaultStage: 'letterShow',
  questionCount: ALPHABET_DEFAULT_QUESTION_COUNT,
  defaultPlayerCount: 1,
  volume: DEFAULT_ALPHABET_SETTINGS.volume,
};

/**
 * Дефолтные размеры на канвасе при добавлении виджета. На рантайм не влияют
 * (виджет занимает весь экран), но нужны, чтобы заглушка в редакторе
 * выглядела осмысленно — те же 1280×800, что у natcom и words.
 */
export const ALPHABET_DEFAULT_SIZE = {
  width: 1280,
  height: 800,
};
