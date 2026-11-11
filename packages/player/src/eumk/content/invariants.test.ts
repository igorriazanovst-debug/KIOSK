// Инвариантная батарея контента ЭУМК (волна 0, K5_контент_план §3).
//
// Семейство анти-эвристик H1-H12 по уроку Тип6 «Матемашка» (класс дефектов
// «контент решаем не тем навыком»): перечислимое семейство, растёт одной
// строкой на новую находку. Применяется ко всем категориальным сигналам о
// верном ответе разом: позиция кнопки, числовой ранг, длина/форма,
// порядок слов в тексте, групповые структурные признаки.
//
// Это быстрая CI-версия с фиксированными порогами. Статистическая
// калибровка (наблюдаемый уровень <= 30-го перцентиля распределения на
// N=20000 случайных перестановок вариантов, план §3.4) выполняется
// offline-скриптом вне репозитория; его отчёт живёт в админ-папке ТЗ.
//
// Важное из §1.1 плана: варианты СТАТИЧЕСКИХ заданий (choice/multi/gaps)
// на экране НЕ перемешиваются - порядок в JSON = порядок кнопок. Поэтому
// позиционные эвристики (H1-H3, H9, H12) применяются к ним в полную силу;
// банк и игровые раунды перемешиваются рантаймом - там остаются только
// «формальные» оси (H4-H8).
//
// Структурные инварианты волн (счётчики K0 появляются по мере волн):
// S1 - у каждой единицы источник (и пояснение у банка);
// S2 - непустота block/section у контентных заданий (существование
//      проверяет схема, см. superRefine);
// S3 - тексты формулировок уникальны (урок роста до 28/25 на блок);
// S4 - пул каждого уровня round-игры >= полной серии (ROUNDS_PER_PLAY=10);
//      исключение - sequence (dg-1): серия по построению равна числу групп
//      уровня (прогрессивные уровни by-design), не pick-10 механика.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { EumkContent, EumkTask } from '../model/schema.ts';

function load(name: string): EumkContent {
  const url = new URL(`./${name}.content.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

const SUITES: ReadonlyArray<{ name: string; label: string; content: EumkContent }> = [
  { name: 'nach', label: 'начальные классы', content: load('nach') },
  { name: 'dosh', label: 'дошкольное образование', content: load('dosh') },
];

// Полная серия round-игры (gameRounds.ROUNDS_PER_PLAY); продублировано,
// чтобы батарея не тянула за собой движок игр.
const ROUNDS_PER_PLAY = 10;

// Type guard, чтобы после фильтра tsc сужал дискриминированный союз TaskSchema.
const byType = <T extends EumkTask['type']>(c: EumkContent, type: T) =>
  c.tasks.filter((t): t is Extract<EumkTask, { type: T }> => t.type === type);

// Первое число в тексте варианта (для возрастных «В 3–4 года» -> 3):
// если во всех вариантах вопроса оно распарсилось, вопрос числовой.
function firstNumber(s: string): number | null {
  const m = s.match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}

function isNumericQuestion(options: readonly string[]): boolean {
  return options.every((o) => firstNumber(o) !== null);
}

// Ранг верного среди отсортированных по величине вариантов (0 = наименьший).
function numericRank(options: readonly string[], answer: number): number {
  const a = firstNumber(options[answer])!;
  return options.filter((o) => firstNumber(o)! < a).length;
}

function shares(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((n) => n / total);
}

// «Верный - самый длинный/короткий» с защитой от ничьих (равно-экстремальные
// не считаем: эвристика не даёт безошибочного выбора).
function isExtremeByLength(options: readonly string[], answer: number, kind: 'longest' | 'shortest'): boolean {
  const lens = options.map((o) => o.length);
  const [lo, hi] = [Math.min(...lens), Math.max(...lens)];
  const target = kind === 'longest' ? hi : lo;
  return lens[answer] === target && lens.filter((l) => l === target).length === 1;
}

function isPrefix(indices: readonly number[], listLength: number): boolean {
  return indices.length > 0 && indices.every((v, i) => v === i);
}

function isSuffix(indices: readonly number[], listLength: number): boolean {
  return indices.length > 0 && indices.every((v, i) => v === listLength - indices.length + i);
}

// Непрерывный интервал [start, start+k) - покрывает и префикс, и суффикс.
function isInterval(indices: readonly number[]): boolean {
  const sorted = [...indices].sort((a, b) => a - b);
  return sorted.every((v, i) => v === sorted[0] + i);
}

const hasMarker = (s: string) => /[0-9№«]/.test(s);

for (const { name, label, content } of SUITES) {
  const choice = byType(content, 'choice');
  const multi = byType(content, 'multi');
  const gaps = byType(content, 'gaps');
  const order = byType(content, 'order');
  const sort = byType(content, 'sort');
  const match = byType(content, 'match');

  // ---------- H1-H3: позиция верного в choice-заданиях ----------

  test(`${name} H1: позиция верного в choice-заданиях распределена (не одна кнопка)`, () => {
    assert.ok(choice.length >= 2, 'в комплексе должно быть хотя бы два choice-задания');
    const positions = choice.map((t) => t.data.correct[0]);
    const distinct = new Set(positions);
    assert.ok(distinct.size >= 2, `верный всегда на позиции ${positions[0]}: ${choice.map((t) => t.id)}`);
    const counts = shares([...distinct].map((p) => positions.filter((x) => x === p).length));
    assert.ok(Math.max(...counts) <= 0.75, `одна позиция занимает больше 75%: ${positions.join(',')}`);
  });

  test(`${name} H2: позиции choice-заданий не образуют цикл периода 2-3`, () => {
    const positions = choice.map((t) => t.data.correct[0]);
    for (const period of [2, 3]) {
      if (positions.length < period * 2) continue;
      const cyclic = positions.every((p, i) => p === positions[i % period]);
      assert.ok(!cyclic, `позиции образуют цикл периода ${period}: ${positions.join(',')}`);
    }
  });

  test(`${name} H3: позиции choice-заданий не арифметическая прогрессия`, () => {
    const positions = choice.map((t) => t.data.correct[0]);
    if (positions.length < 3) return;
    const step = positions[1] - positions[0];
    const isAp = step !== 0 && positions.every((p, i) => i === 0 || p - positions[i - 1] === step);
    assert.ok(!isAp, `позиции - арифметическая прогрессия (шаг ${step}): ${positions.join(',')}`);
  });

  // ---------- H9: multi-наборы ----------

  test(`${name} H9: multi-наборы не префикс/суффикс/интервал списка вариантов`, () => {
    for (const t of multi) {
      const c = [...t.data.correct].sort((a, b) => a - b);
      assert.ok(!isInterval(c), `${t.id}: верные варианты - непрерывный кусок списка (${c})`);
    }
  });

  test(`${name} H9: ни один индекс варианта не отмечен верным во всех multi-наборах`, () => {
    assert.ok(multi.length >= 2, 'должно быть хотя бы два multi-задания');
    const width = Math.max(...multi.map((t) => t.data.options.length));
    for (let i = 0; i < width; i++) {
      const share = multi.filter((t) => t.data.correct.includes(i)).length / multi.length;
      assert.ok(share <= 0.75, `индекс ${i} верен в ${Math.round(share * 100)}% multi-наборов`);
    }
  });

  test(`${name} H9: в multi нельзя решить «отметь k самых длинных»`, () => {
    const exploitable = multi.filter((t) => {
      const lens = t.data.options.map((o) => o.length);
      const k = t.data.correct.length;
      const sorted = lens.map((l, i) => ({ l, i })).sort((a, b) => b.l - a.l);
      const topK = new Set(sorted.slice(0, k).map((x) => x.i));
      // Граница без ничьей: k-й и k+1-й по длине различаются.
      const boundaryClean = sorted.length <= k || sorted[k - 1].l > sorted[k].l;
      return boundaryClean && t.data.correct.every((i) => topK.has(i));
    });
    assert.ok(exploitable.length / multi.length <= 0.5, `«самые длинные = верные» в ${exploitable.map((t) => t.id).join(', ')}`);
  });

  // ---------- H12: gaps ----------

  test(`${name} H12: ответы gaps не стоят в начале/конце списка вариантов`, () => {
    for (const t of gaps) {
      const idx = [...new Set(t.data.answers.map((a) => t.data.options.indexOf(a)))].sort((a, b) => a - b);
      assert.ok(!isPrefix(idx, t.data.options.length), `${t.id}: ответы - первые варианты списка`);
      assert.ok(!isSuffix(idx, t.data.options.length), `${t.id}: ответы - последние варианты списка`);
    }
  });

  test(`${name} H12: первый вариант не является ответом почти во всех gaps`, () => {
    const zeroAnswer = gaps.filter((t) => t.data.answers.map((a) => t.data.options.indexOf(a)).includes(0)).length;
    assert.ok(zeroAnswer / gaps.length <= 0.75, `первый вариант - ответ в ${zeroAnswer} из ${gaps.length}`);
  });

  // ---------- H4-H6: формальные оси банка (позиция нейтрализована рантаймом) ----------

  test(`${name} H4: в банке нет majority-стратегии по позициям (каждая <= 35%)`, () => {
    const counts = [0, 0, 0, 0];
    for (const q of content.bank) counts[q.answer]++;
    for (const share of shares(counts)) {
      assert.ok(share <= 0.35, `позиция занимает больше 35% банка: ${counts.join('/')}`);
    }
  });

  test(`${name} H6: верный в банке не систематически самый длинный и не самый короткий`, () => {
    const longest = content.bank.filter((q) => isExtremeByLength(q.options, q.answer, 'longest')).length;
    const shortest = content.bank.filter((q) => isExtremeByLength(q.options, q.answer, 'shortest')).length;
    assert.ok(longest / content.bank.length < 0.35, `верный - самый длинный в ${longest}/${content.bank.length}`);
    assert.ok(shortest / content.bank.length < 0.35, `верный - самый короткий в ${shortest}/${content.bank.length}`);
  });

  test(`${name} H6: верный в choice/multi-заданиях не крайний по длине в 3/4 заданий`, () => {
    for (const kind of ['longest', 'shortest'] as const) {
      const flagged = [...choice, ...multi].filter((t) => isExtremeByLength(t.data.options, t.data.correct[0], kind));
      assert.ok(
        flagged.length / (choice.length + multi.length) < 0.75,
        `верный - самый ${kind === 'longest' ? 'длинный' : 'короткий'} в ${flagged.map((t) => t.id).join(', ')}`,
      );
    }
  });

  test(`${name} H6: верный - не единственный вариант с цифрой/№/кавычками (odd-one-out <= 1/3)`, () => {
    const units: Array<{ id: string; options: string[]; correct: number[] }> = [
      ...content.bank.map((q) => ({ id: q.id, options: q.options, correct: [q.answer] })),
      ...choice.map((t) => ({ id: t.id, options: t.data.options, correct: t.data.correct })),
      ...multi.map((t) => ({ id: t.id, options: t.data.options, correct: t.data.correct })),
    ];
    const odd = units.filter((u) => {
      const correctMarked = u.correct.some((i) => hasMarker(u.options[i]));
      const wrongClean = u.options.every((o, i) => u.correct.includes(i) || !hasMarker(o));
      return correctMarked && wrongClean;
    });
    assert.ok(odd.length / units.length <= 1 / 3, `odd-one-out в ${odd.map((u) => u.id).join(', ')}`);
  });

  // ---------- H5: числовой ранг ----------

  test(`${name} H5: ранг верного в числовых вопросах банка не константен и не «всегда средний»`, () => {
    const numeric = content.bank.filter((q) => isNumericQuestion(q.options));
    if (numeric.length < 4) return; // слишком мало - ось бессмысленна
    const ranks = numeric.map((q) => numericRank(q.options, q.answer));
    const byRank = [...new Set(ranks)].map((r) => ranks.filter((x) => x === r).length / ranks.length);
    assert.ok(Math.max(...byRank) <= 0.6, `один ранг занимает больше 60%: ранги ${ranks.join(',')}`);
    // Медианная эвристика «выбирай не крайнее значение»: ранги 1..n-2.
    const middle = ranks.filter((r) => r > 0 && r < Math.max(...ranks)).length / ranks.length;
    assert.ok(middle <= 0.6, `верный - средний по величине в ${Math.round(middle * 100)}% числовых вопросов`);
  });

  test(`${name} H5: ранг верного в числовых раундах каждой logic-игры варьируется`, () => {
    const logicGames = content.games.filter((g) => g.type === 'logic');
    if (logicGames.length === 0) return; // в дошкольном нет logic-игр
    for (const logic of logicGames) {
      const tasks = (logic.data.tasks ?? []) as Array<{ options: string[]; correct: number }>;
      const numeric = tasks.filter((t) => isNumericQuestion(t.options));
      if (numeric.length < 4) continue;
      const ranks = numeric.map((t) => numericRank(t.options, t.correct));
      const byRank = [...new Set(ranks)].map((r) => ranks.filter((x) => x === r).length / ranks.length);
      assert.ok(Math.max(...byRank) <= 0.6, `${logic.id}: один ранг занимает больше 60%: ранги ${ranks.join(',')}`);
      const middle = ranks.filter((r) => r > 0 && r < Math.max(...ranks)).length / ranks.length;
      assert.ok(middle <= 0.6, `${logic.id}: верный - средний по величине в ${Math.round(middle * 100)}% числовых раундов`);
    }
  });

  // ---------- H7: порядок слов в тексте ----------

  test(`${name} H7: формулировки вопросов банка не повторяются`, () => {
    const seen = new Map<string, string>();
    for (const q of content.bank) {
      const key = q.question.trim().toLowerCase();
      assert.ok(!seen.has(key), `повтор формулировки: ${q.id} и ${seen.get(key)}`);
      seen.set(key, q.id);
    }
  });

  test(`${name} H7: инструкции заданий не повторяются`, () => {
    const seen = new Map<string, string>();
    for (const t of content.tasks) {
      const key = t.instruction.trim().toLowerCase();
      assert.ok(!seen.has(key), `повтор инструкции: ${t.id} и ${seen.get(key)}`);
      seen.set(key, t.id);
    }
  });

  test(`${name} H7: в сравнительных вопросах «или» верный не всегда назван первым`, () => {
    const comparative = content.bank.flatMap((q) => {
      const mentioned = q.options
        .map((o, i) => ({ pos: q.question.indexOf(o), i }))
        .filter((m) => m.pos >= 0);
      return mentioned.length === 2 && Math.min(...mentioned.map((m) => m.pos)) >= 0
        ? [{ id: q.id, firstIsCorrect: mentioned.reduce((a, b) => (a.pos <= b.pos ? a : b)).i === q.answer }]
        : [];
    });
    if (comparative.length < 2) return;
    const first = comparative.filter((c) => c.firstIsCorrect).length / comparative.length;
    assert.ok(first <= 0.75, `верный назван первым в ${comparative.filter((c) => c.firstIsCorrect).map((c) => c.id).join(', ')}`);
  });

  // ---------- H8: групповые структурные признаки ----------

  test(`${name} H8: внутри блока длина верного ответа не константа`, () => {
    for (const block of content.theory) {
      const qs = content.bank.filter((q) => q.block === block.id);
      if (qs.length < 4) continue;
      const lens = new Set(qs.map((q) => q.options[q.answer].length));
      assert.ok(lens.size >= 2, `блок ${block.id}: верный всегда длиной ${[...lens][0]}`);
    }
  });

  test(`${name} H8: верный не короче всех дистракторов систематически`, () => {
    const shorter = content.bank.filter((q) => q.options.every((o, i) => i === q.answer || o.length > q.options[q.answer].length)).length;
    assert.ok(shorter / content.bank.length < 0.35, `верный строго короче остальных в ${shorter}/${content.bank.length}`);
  });

  // ---------- H10: order ----------

  test(`${name} H10: инструкция order-задания не называет элементы в правильном порядке`, () => {
    for (const t of order) {
      const pos = t.data.items.map((item) => t.instruction.indexOf(item));
      if (pos.some((p) => p < 0)) continue; // элементы не упомянуты - оси нет
      const increasing = pos.every((p, i) => i === 0 || p > pos[i - 1]);
      assert.ok(!increasing, `${t.id}: инструкция перечисляет элементы в правильном порядке`);
    }
  });

  // ---------- H11: match/sort ----------

  test(`${name} H11: в match верная правая часть не «всегда самая длинная»`, () => {
    for (const t of match) {
      const rights = t.data.pairs.map((p) => p[1]);
      const hi = Math.max(...rights.map((r) => r.length));
      const uniqueLongest = rights.filter((r) => r.length === hi).length === 1;
      const longestPairs = t.data.pairs.filter(([, r]) => uniqueLongest && r.length === hi).length;
      assert.ok(longestPairs / t.data.pairs.length <= 0.5, `${t.id}: самая длинная правая часть - верная пара`);
    }
  });

  test(`${name} H11: в sort нет категории-«переполнения» и задействовано >= 2 категорий`, () => {
    for (const t of sort) {
      const used = new Set(t.data.items.map((i) => i.category));
      assert.ok(used.size >= 2, `${t.id}: все элементы в одной категории`);
      if (t.data.items.length >= 4) {
        for (const cat of used) {
          const share = t.data.items.filter((i) => i.category === cat).length / t.data.items.length;
          assert.ok(share <= 0.7, `${t.id}: категория «${cat}» забирает ${Math.round(share * 100)}% элементов`);
        }
      }
    }
  });

  // ---------- S1: источники и пояснения ----------

  test(`${name} S1: у каждого вопроса банка есть пояснение и источник`, () => {
    for (const q of content.bank) {
      assert.ok(q.explanation.trim() !== '', `${q.id}: нет пояснения`);
      assert.ok(q.sources.length >= 1, `${q.id}: нет источников`);
    }
  });

  test(`${name} S1: у каждого задания, игры и кейса есть источник`, () => {
    for (const t of content.tasks) assert.ok(t.sources.length >= 1, `${t.id}: нет источников`);
    for (const g of content.games) assert.ok(g.sources.length >= 1, `${g.id}: нет источников`);
    for (const c of content.cases) {
      assert.ok(c.sources.length >= 1, `${c.id}: нет источников`);
      for (const q of c.questions) {
        assert.ok(q.model.trim() !== '', `${c.id}: вопрос без эталона ответа`);
        assert.ok(q.sources.length >= 1, `${c.id}: вопрос без источников`);
      }
    }
  });

  test(`${name} S1: у каждого раздела теории есть пример и источник`, () => {
    for (const b of content.theory) {
      for (const s of b.sections) {
        assert.ok(s.example !== null, `${s.id}: нет примера`);
        assert.ok(s.sources.length >= 1, `${s.id}: нет источников`);
      }
    }
  });

  // ---------- S2: непустота привязок (существование проверяет схема) ----------

  test(`${name} S2: у контентных заданий заполнены block и section`, () => {
    for (const t of content.tasks) {
      assert.ok(t.block !== '', `${t.id}: пустой block`);
      assert.ok(t.section !== '', `${t.id}: пустой section`);
    }
    for (const q of content.bank) assert.ok(q.section !== '', `${q.id}: пустой section`);
  });

  // ---------- S4: пулы round-игр ----------

  test(`${name} S4: пул каждого уровня pick-10 игры покрывает полную серию`, () => {
    const rows = (v: unknown) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []);
    for (const g of content.games) {
      if (g.type === 'sequence') continue; // серия = группы уровня, by-design
      if (g.type === 'logic' || g.type === 'math') {
        const byLevel = new Map<number, number>();
        for (const t of rows(g.data.tasks)) byLevel.set(Number(t.level), (byLevel.get(Number(t.level)) ?? 0) + 1);
        for (const [level, n] of byLevel) {
          assert.ok(n >= ROUNDS_PER_PLAY, `${g.id}: уровень ${level} - только ${n} задач (серия ${ROUNDS_PER_PLAY})`);
        }
      }
      if (g.type === 'syllables') {
        const byLevel = new Map<number, number>();
        for (const w of rows(g.data.words)) byLevel.set(Number(w.level), (byLevel.get(Number(w.level)) ?? 0) + 1);
        for (const [level, n] of byLevel) {
          assert.ok(n >= ROUNDS_PER_PLAY, `${g.id}: уровень ${level} - только ${n} слов`);
        }
      }
      if (g.type === 'costume') {
        assert.ok(rows(g.data.heroes).length >= ROUNDS_PER_PLAY, `${g.id}: героев меньше полной серии`);
      }
      if (g.type === 'ecology') {
        const pairs = rows(g.data.pairs);
        for (const l of g.levels) {
          const kinds = (l.kinds as string[]) ?? [];
          const n = pairs.filter((p) => kinds.includes(String(p.kind))).length;
          const need = Math.min(Number(l.cards ?? ROUNDS_PER_PLAY), ROUNDS_PER_PLAY);
          assert.ok(n >= need, `${g.id}: уровень ${l.level} - пар ${n} < ${need}`);
        }
      }
      if (g.type === 'speech') {
        const words = rows(g.data.words);
        for (const l of g.levels) {
          const wordLevels = (l.wordLevels as number[]) ?? [1];
          const n = words.filter((w) => wordLevels.includes(Number(w.level))).length;
          assert.ok(n >= ROUNDS_PER_PLAY, `${g.id}: уровень ${l.level} - слов ${n} < ${ROUNDS_PER_PLAY}`);
        }
      }
    }
  });
}
