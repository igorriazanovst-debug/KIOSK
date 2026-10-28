// Генераторы раундов для игр, построенных на заданиях с выбором и
// расстановкой: логические задачи, слоги, костюмы, режим дня, речь,
// экология, математика. Раунд - это обычное задание (EumkTask), поэтому
// проверка и экран ответа общие с практическими заданиями. Игры
// «Концентрация внимания» и «Наблюдательность» устроены иначе и живут в
// своих модулях (attentionLogic.ts, observationLogic.ts).

import { pickWithoutRepeat, shuffled, type Rng } from './rng.ts';
import { TaskSchema, type EumkGame, type EumkTask } from './model/schema.ts';

export const ROUND_GAME_TYPES: readonly EumkGame['type'][] = ['syllables', 'logic', 'costume', 'sequence', 'speech', 'ecology', 'math'];
export const ROUNDS_PER_PLAY = 10;
const OPTIONS_PER_CHOICE = 4;

export interface GameRound {
  id: string;
  task: EumkTask;
  hint: string | null;
  // Картинка раунда (математика): список фигур для отрисовки, либо null.
  scene: SceneObject[] | null;
}

export interface SceneObject {
  shape: string;
  color: string;
  count: number;
  group?: string;
  size?: number;
}

type Row = Record<string, unknown>;

const LABELS: Record<string, string> = {
  left: 'слева', right: 'справа', equal: 'поровну',
  circle: 'круг', square: 'квадрат', triangle: 'треугольник', oval: 'овал', rectangle: 'прямоугольник',
  star: 'звезда', diamond: 'ромб',
};

function label(value: unknown): string {
  const text = String(value);
  return Object.prototype.hasOwnProperty.call(LABELS, text) ? LABELS[text] : text;
}

function rows(game: EumkGame, key: string): Row[] {
  const value = game.data[key];
  return Array.isArray(value) ? (value as Row[]) : [];
}

function str(row: Row, key: string): string {
  return String(row[key] ?? '');
}

function num(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

// Варианты ответа: верный + отвлекающие, без повторов, в случайном порядке.
function choiceOptions(correct: string, distractors: readonly string[], rng: Rng, size = OPTIONS_PER_CHOICE) {
  const unique = [...new Set(distractors)].filter((d) => d !== correct);
  const options = shuffled([correct, ...pickWithoutRepeat(unique, size - 1, rng)], rng);
  return { options, correct: [options.indexOf(correct)] };
}

function choiceTask(id: string, title: string, instruction: string, correct: string, distractors: readonly string[], explanation: string, rng: Rng): EumkTask {
  const { options, correct: idx } = choiceOptions(correct, distractors, rng);
  return { id, block: '', section: '', title, instruction, explanation, sources: [], type: 'choice', data: { options, correct: idx } };
}

function round(id: string, task: EumkTask, hint: string | null = null, scene: SceneObject[] | null = null): GameRound {
  return { id, task, hint, scene };
}

// ---------- Уровни ----------

export function gameLevels(game: EumkGame): number[] {
  if (game.levels.length > 0) return game.levels.map((l) => Number(l.level));
  const levels = new Set<number>();
  const source = game.type === 'logic' || game.type === 'math' ? rows(game, 'tasks') : game.type === 'syllables' ? rows(game, 'words') : [];
  for (const row of source) levels.add(num(row, 'level'));
  return levels.size > 0 ? [...levels].sort((a, b) => a - b) : [1];
}

// ---------- Логические задачи ----------

function logicRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  const pool = rows(game, 'tasks').filter((t) => num(t, 'level') === level);
  return pickWithoutRepeat(pool, ROUNDS_PER_PLAY, rng).map((t, index) => {
    const options = (t.options as unknown[]).map(String);
    const correct = options[num(t, 'correct')];
    const shown = choiceOptions(correct, options, rng, options.length);
    return round(`${game.id}-L${level}-${index}-${str(t, 'question').slice(0, 24)}`, {
      id: `${game.id}-${index}`, block: '', section: '', title: str(t, 'kind'), instruction: str(t, 'question'),
      explanation: str(t, 'explanation'), sources: [], type: 'choice', data: { options: shown.options, correct: shown.correct },
    });
  });
}

// ---------- Слоги ----------

function syllableRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  const pool = rows(game, 'words').filter((w) => num(w, 'level') === level);
  return pickWithoutRepeat(pool, ROUNDS_PER_PLAY, rng).map((w) => {
    const syllables = (w.syllables as unknown[]).map(String);
    return round(`${game.id}-L${level}-${str(w, 'word')}`, {
      id: `${game.id}-${str(w, 'word')}`, block: '', section: '', title: str(w, 'word'),
      instruction: `Расставь слоги слова «${str(w, 'word')}» по порядку`, explanation: `Слово делится так: ${str(w, 'division')}`,
      sources: [], type: 'order', data: { items: syllables },
    });
  });
}

// ---------- Подбор костюма ----------

function costumeRounds(game: EumkGame, _level: number, rng: Rng): GameRound[] {
  return pickWithoutRepeat(rows(game, 'heroes'), ROUNDS_PER_PLAY, rng).map((h) => {
    const right = pickWithoutRepeat((h.correct as unknown[]).map(String), 3, rng);
    const wrong = pickWithoutRepeat((h.wrong as unknown[]).map(String).filter((w) => !right.includes(w)), 3, rng);
    const options = shuffled([...right, ...wrong], rng);
    return round(`${game.id}-${str(h, 'hero')}`, {
      id: `${game.id}-${str(h, 'hero')}`, block: '', section: '', title: str(h, 'hero'),
      instruction: `Герой: ${str(h, 'hero')} («${str(h, 'work')}», ${str(h, 'author')}). Выбери всё, что есть в его облике по тексту`,
      explanation: str(h, 'evidence'), sources: [str(h, 'sourceUrl')].filter(Boolean), type: 'multi',
      data: { options, correct: right.map((item) => options.indexOf(item)) },
    });
  });
}

// ---------- Режим дня ----------

interface Moment { label: string; why: string; core: boolean; order: number }

function sequenceRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  const config = game.levels.find((l) => Number(l.level) === level);
  if (!config) return [];
  const groupIds = (config.groups as string[]) ?? [];
  const onlyCore = config.onlyCore === true;
  const out: GameRound[] = [];
  for (const group of rows(game, 'groups').filter((g) => groupIds.includes(str(g, 'id')))) {
    const moments = (group.moments as Moment[]).filter((m) => !onlyCore || m.core).sort((a, b) => a.order - b.order);
    if (moments.length < 2) continue;
    out.push(round(`${game.id}-L${level}-${str(group, 'id')}`, {
      id: `${game.id}-${str(group, 'id')}`, block: '', section: '', title: str(group, 'title'),
      instruction: 'Расставь режимные моменты дня в правильном порядке',
      explanation: moments.map((m) => `${m.label}: ${m.why}`).join(' '), sources: [], type: 'order',
      data: { items: moments.map((m) => m.label) },
    }, config.showHints === true ? 'Начни с приёма детей и иди по порядку до ухода домой' : null));
  }
  return out;
}

// ---------- Речь ----------

interface SpeechWord { word: string; syllables: string[]; syllableCount: number; stressedSyllable: number; sounds: string[]; soundsCount: number; firstSound: string; level: number }

const POSITION_LABELS = ['начало', 'середина', 'конец'];

function speechRound(game: EumkGame, type: string, words: SpeechWord[], targets: Record<string, Row>, sounds: string[], rng: Rng, index: number): GameRound | null {
  const w = pickWithoutRepeat(words, 1, rng)[0];
  if (!w) return null;
  const id = `${game.id}-${type}-${w.word}-${index}`;
  const mk = (title: string, instruction: string, correct: string, distractors: string[], explanation: string) =>
    round(id, choiceTask(id, title, instruction, correct, distractors, explanation, rng));
  switch (type) {
    case 'firstSound':
      return mk('Первый звук', `С какого звука начинается слово «${w.word}»?`, w.firstSound, sounds, `Слово «${w.word}» начинается со звука [${w.firstSound}].`);
    case 'syllables':
      return mk('Слоги', `Сколько слогов в слове «${w.word}»?`, String(w.syllableCount), ['1', '2', '3', '4'], `${w.word}: ${w.syllables.join('-')}.`);
    case 'stress':
      if (w.syllables.length < 2) return null;
      return mk('Ударение', `Какой по счёту слог ударный в слове «${w.word}» (${w.syllables.join('-')})?`, `${w.stressedSyllable}-й слог`,
        w.syllables.map((_, i) => `${i + 1}-й слог`), `Ударение падает на ${w.stressedSyllable}-й слог: «${w.syllables[w.stressedSyllable - 1]}».`);
    case 'soundsCount':
      return mk('Число звуков', `Сколько звуков в слове «${w.word}»?`, String(w.soundsCount), ['3', '4', '5', '6'], `В слове «${w.word}» звуков: ${w.sounds.join(', ')}.`);
    case 'soundPosition': {
      const entries = sounds.flatMap((s) => {
        const pos = (targets[s]?.positions ?? {}) as Record<string, string[]>;
        return Object.entries(pos).map(([word, p]) => ({ sound: s, word, place: p[0] }));
      });
      const e = pickWithoutRepeat(entries, 1, rng)[0];
      if (!e) return null;
      const pid = `${game.id}-pos-${e.sound}-${e.word}-${index}`;
      return round(pid, choiceTask(pid, 'Место звука', `Где в слове «${e.word}» слышится звук [${e.sound}]?`, e.place, POSITION_LABELS, `Звук [${e.sound}] в слове «${e.word}»: ${e.place}.`, rng));
    }
    default:
      return null;
  }
}

function findWordsRound(game: EumkGame, sound: string, targets: Record<string, Row>, rng: Rng, index: number): GameRound | null {
  const entry = targets[sound];
  if (!entry) return null;
  const withSound = pickWithoutRepeat((entry.wordsWith as unknown[]).map(String), 3, rng);
  const without = pickWithoutRepeat((entry.wordsWithout as unknown[]).map(String), 3, rng);
  const options = shuffled([...withSound, ...without], rng);
  const id = `${game.id}-find-${sound}-${index}`;
  return round(id, {
    id, block: '', section: '', title: `Слова со звуком [${sound}]`, instruction: `Выбери слова, в которых слышится звук [${sound}]`,
    explanation: `Со звуком [${sound}]: ${withSound.join(', ')}.`, sources: [], type: 'multi',
    data: { options, correct: withSound.map((word) => options.indexOf(word)) },
  });
}

function speechRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  const config = game.levels.find((l) => Number(l.level) === level);
  if (!config) return [];
  const wordLevels = (config.wordLevels as number[]) ?? [1];
  const range = config.soundsCountRange as number[] | undefined;
  const sounds = (config.targetSounds as string[]) ?? [];
  const targets = (game.data.targets ?? {}) as Record<string, Row>;
  const words = (rows(game, 'words') as unknown as SpeechWord[]).filter((w) =>
    wordLevels.includes(Number(w.level)) && (!range || (w.soundsCount >= range[0] && w.soundsCount <= range[1])));
  const types = (config.taskTypes as string[]) ?? ['firstSound'];
  const out: GameRound[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < ROUNDS_PER_PLAY && i < ROUNDS_PER_PLAY * 6; i++) {
    const type = types[i % types.length];
    const sound = sounds[Math.floor(rng() * sounds.length)];
    const r = type === 'findWords' ? findWordsRound(game, sound, targets, rng, i) : speechRound(game, type, words, targets, sounds, rng, i);
    const key = r ? r.task.instruction : '';
    if (r && !seen.has(key)) { seen.add(key); out.push(r); }
  }
  return out;
}

// ---------- Экология ----------

interface Pair { id: string; name: string; kind: string; habitat: string; foodType: string; winter: string | null; wildOrDomestic?: string }
interface Dict { id: string; label: string }

function dictLabel(list: Dict[], id: string): string {
  return list.find((d) => d.id === id)?.label ?? id;
}

function ecologyRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  const config = game.levels.find((l) => Number(l.level) === level);
  if (!config) return [];
  const kinds = (config.kinds as string[]) ?? [];
  const questionTypes = (config.questionTypes as string[]) ?? ['habitat'];
  const habitats = (game.data.habitats ?? []) as Dict[];
  const foods = (game.data.foodTypes ?? []) as Dict[];
  const winters = (game.data.winterOptions ?? []) as Dict[];
  const pairs = (rows(game, 'pairs') as unknown as Pair[]).filter((p) => kinds.includes(p.kind));
  const count = Math.min(Number(config.cards ?? ROUNDS_PER_PLAY), pairs.length);
  return pickWithoutRepeat(pairs, count, rng).map((p, index) => {
    const allowed = questionTypes.filter((t) => (t !== 'winter' || p.winter != null) && (t !== 'wild' || !!p.wildOrDomestic) && (t !== 'food' || p.foodType !== 'plant'));
    const type = allowed.length > 0 ? allowed[Math.floor(rng() * allowed.length)] : 'habitat';
    const id = `${game.id}-L${level}-${p.id}-${type}`;
    if (type === 'food') {
      return round(id, choiceTask(id, p.name, `Чем питается: ${p.name}?`, dictLabel(foods, p.foodType), foods.map((f) => f.label), `${p.name}: ${dictLabel(foods, p.foodType)}.`, rng));
    }
    if (type === 'wild' && p.wildOrDomestic) {
      return round(id, choiceTask(id, p.name, `${p.name}: дикое или домашнее животное?`, p.wildOrDomestic, ['дикое', 'домашнее'], `${p.name} - ${p.wildOrDomestic} животное.`, rng));
    }
    if (type === 'winter' && p.winter) {
      return round(id, choiceTask(id, p.name, `Что делает зимой: ${p.name}?`, dictLabel(winters, p.winter), winters.map((w) => w.label), `${p.name}: ${dictLabel(winters, p.winter)}.`, rng));
    }
    return round(id, choiceTask(id, p.name, `Где живёт: ${p.name}?`, dictLabel(habitats, p.habitat), habitats.map((h) => h.label), `${p.name}: ${dictLabel(habitats, p.habitat)}.`, rng));
  });
}

// ---------- Математика ----------

const MATH_TITLES: Record<string, string> = {
  count: 'Счёт', number: 'Число', compare: 'Сравнение', compare_diff: 'На сколько больше', size: 'Величина', shape: 'Фигуры',
  space: 'Положение в пространстве', time: 'Время', ordinal: 'Порядковый счёт', seriation: 'Сравни по длине и расставь по порядку',
  classify: 'Группировка', decompose: 'Состав числа', add: 'Сложение', subtract: 'Вычитание',
};

function mathRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  const pool = rows(game, 'tasks').filter((t) => num(t, 'level') === level);
  return pickWithoutRepeat(pool, ROUNDS_PER_PLAY, rng).map((t) => {
    const scene = ((t.scene as Row | undefined)?.objects ?? []) as SceneObject[];
    const id = `${game.id}-${str(t, 'id')}`;
    const hint = str(t, 'hint') || null;
    if (Array.isArray(t.answer)) {
      return round(id, {
        id, block: '', section: '', title: MATH_TITLES[str(t, 'type')] ?? 'Задание', instruction: str(t, 'prompt'), explanation: str(t, 'hint'), sources: [],
        type: 'order', data: { items: (t.answer as unknown[]).map(String) },
      }, hint, scene);
    }
    const options = (t.options as unknown[]).map(label);
    const shown = choiceOptions(label(t.answer), options, rng, options.length);
    return round(id, {
      id, block: '', section: '', title: MATH_TITLES[str(t, 'type')] ?? 'Задание', instruction: str(t, 'prompt'), explanation: str(t, 'hint'), sources: [],
      type: 'choice', data: { options: shown.options, correct: shown.correct },
    }, hint, scene);
  });
}

// ---------- Вход ----------

// Данные игр приходят из контента и не проверяются схемой до уровня полей,
// поэтому раунд, собранный из битой записи, отбрасывается, а не роняет игру.
export function buildGameRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  try {
    return generateRounds(game, level, rng).filter((r) => TaskSchema.safeParse(r.task).success);
  } catch {
    return [];
  }
}

function generateRounds(game: EumkGame, level: number, rng: Rng): GameRound[] {
  switch (game.type) {
    case 'logic': return logicRounds(game, level, rng);
    case 'syllables': return syllableRounds(game, level, rng);
    case 'costume': return costumeRounds(game, level, rng);
    case 'sequence': return sequenceRounds(game, level, rng);
    case 'speech': return speechRounds(game, level, rng);
    case 'ecology': return ecologyRounds(game, level, rng);
    case 'math': return mathRounds(game, level, rng);
    default: return [];
  }
}
