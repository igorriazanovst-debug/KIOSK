// Итоговый тест: случайная сборка из банка при каждом входе, подсчёт
// баллов, отметка и отчёт. Чистые функции без DOM; источник случайности
// передаётся параметром (rng).

import { shuffled, type Rng } from './rng.ts';
import type { BankQuestion, GradeScale } from './model/schema.ts';

// Сколько раз пробуем собрать комбинацию, которой у пользователя ещё не было.
const MAX_UNIQUE_ATTEMPTS = 200;

export interface TestQuestion {
  id: string;
  block: string;
  question: string;
  explanation: string;
  // Варианты в том порядке, в котором их видит ученик.
  options: string[];
  // optionOrder[p] - индекс исходного варианта, показанного на позиции p.
  optionOrder: number[];
  correctPosition: number;
}

export interface BuiltTest {
  questions: TestQuestion[];
  signature: string;
  // true, если все возможные комбинации уже выпадали пользователю.
  isRepeat: boolean;
}

export interface BuildTestInput {
  bank: readonly BankQuestion[];
  count: number;
  rng: Rng;
  previousSignatures: readonly string[];
}

export function signatureOf(ids: readonly string[]): string {
  return [...ids].sort().join('|');
}

function groupByBlock(bank: readonly BankQuestion[]): Map<string, BankQuestion[]> {
  const groups = new Map<string, BankQuestion[]>();
  for (const q of bank) {
    const list = groups.get(q.block);
    if (list) list.push(q);
    else groups.set(q.block, [q]);
  }
  return groups;
}

// Равномерно по блокам: у каждого блока доля count/число блоков, остаток
// достаётся случайным блокам; если в блоке вопросов не хватает, недобор
// добирается из остальных.
function pickStratified(bank: readonly BankQuestion[], count: number, rng: Rng): BankQuestion[] {
  const groups = groupByBlock(bank);
  const blocks = shuffled([...groups.keys()], rng);
  const target = Math.min(count, bank.length);
  const base = Math.floor(target / blocks.length);
  const remainder = target - base * blocks.length;
  const pools = new Map<string, BankQuestion[]>();
  for (const block of blocks) pools.set(block, shuffled(groups.get(block) ?? [], rng));

  const picked: BankQuestion[] = [];
  blocks.forEach((block, index) => {
    const want = base + (index < remainder ? 1 : 0);
    picked.push(...(pools.get(block) ?? []).splice(0, want));
  });

  let missing = target - picked.length;
  for (const block of blocks) {
    if (missing <= 0) break;
    const extra = (pools.get(block) ?? []).splice(0, missing);
    picked.push(...extra);
    missing -= extra.length;
  }
  return picked;
}

function presentQuestion(q: BankQuestion, rng: Rng): TestQuestion {
  const optionOrder = shuffled([0, 1, 2, 3], rng);
  return {
    id: q.id,
    block: q.block,
    question: q.question,
    explanation: q.explanation,
    options: optionOrder.map((index) => q.options[index]),
    optionOrder,
    correctPosition: optionOrder.indexOf(q.answer),
  };
}

export function buildTest(input: BuildTestInput): BuiltTest {
  const used = new Set(input.previousSignatures);
  let chosen = pickStratified(input.bank, input.count, input.rng);
  let signature = signatureOf(chosen.map((q) => q.id));
  let attempts = 1;
  while (used.has(signature) && attempts < MAX_UNIQUE_ATTEMPTS) {
    chosen = pickStratified(input.bank, input.count, input.rng);
    signature = signatureOf(chosen.map((q) => q.id));
    attempts++;
  }
  const questions = shuffled(chosen, input.rng).map((q) => presentQuestion(q, input.rng));
  return { questions, signature, isRepeat: used.has(signature) };
}

// ---------- Оценка ----------

export function gradeForShare(share: number, scale: GradeScale): 2 | 3 | 4 | 5 {
  if (share >= scale.five) return 5;
  if (share >= scale.four) return 4;
  if (share >= scale.three) return 3;
  return 2;
}

export interface ReportItem {
  id: string;
  block: string;
  question: string;
  explanation: string;
  chosenPosition: number | null;
  correctPosition: number;
  isCorrect: boolean;
  options: string[];
}

export interface BlockResult {
  block: string;
  correct: number;
  total: number;
}

export interface TestReport {
  correct: number;
  total: number;
  share: number;
  grade: 2 | 3 | 4 | 5;
  durationSeconds: number;
  items: ReportItem[];
  byBlock: BlockResult[];
}

// answers: id вопроса -> позиция выбранного варианта (как её видел ученик).
export function scoreTest(
  test: BuiltTest,
  answers: Readonly<Record<string, number | null | undefined>>,
  scale: GradeScale,
  durationSeconds: number,
): TestReport {
  const items: ReportItem[] = test.questions.map((q) => {
    const chosen = answers[q.id];
    const chosenPosition = typeof chosen === 'number' ? chosen : null;
    return {
      id: q.id,
      block: q.block,
      question: q.question,
      explanation: q.explanation,
      chosenPosition,
      correctPosition: q.correctPosition,
      isCorrect: chosenPosition === q.correctPosition,
      options: q.options,
    };
  });

  const correct = items.filter((item) => item.isCorrect).length;
  const total = items.length;
  const share = total === 0 ? 0 : correct / total;

  const blocks = new Map<string, BlockResult>();
  for (const item of items) {
    const entry = blocks.get(item.block) ?? { block: item.block, correct: 0, total: 0 };
    entry.total += 1;
    if (item.isCorrect) entry.correct += 1;
    blocks.set(item.block, entry);
  }

  return {
    correct,
    total,
    share,
    grade: gradeForShare(share, scale),
    durationSeconds,
    items,
    byBlock: [...blocks.values()],
  };
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes} мин ${String(seconds).padStart(2, '0')} с`;
}
