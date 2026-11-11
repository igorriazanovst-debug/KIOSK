// K5-2/K5-3: преподавательский режим - чистый домен без UI.
// Преподаватель (роль teacher у аккаунта) просматривает результаты всех
// обучающихся, сбрасывает им пароли (сам сброс - setAccountPassword из
// passwords-инфраструктуры K5-1) и выгружает итоги: CSV-файл и печатная
// страница. Данные результатов не изменяются - только чтение.

import { formatDuration } from './testEngine.ts';
import type { Account, EumkUserData, TestResult } from './model/schema.ts';

export function isTeacher(account: Pick<Account, 'role'>): boolean {
  return account.role === 'teacher';
}

// Обучающиеся для списка преподавателя: без преподавателей, по алфавиту.
export function studentsOf(data: EumkUserData): Account[] {
  return data.accounts
    .filter((a) => !isTeacher(a))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export interface ResultRow {
  id: string;
  studentName: string;
  result: TestResult;
}

// Строки итогов: все результаты (accountId = null) или одного обучающегося.
// Свежие сверху; преподаватель видит и свои прохождения среди всех.
export function rowsOf(data: EumkUserData, accountId: string | null): ResultRow[] {
  const names = new Map(data.accounts.map((a) => [a.id, a.name]));
  return data.results
    .filter((r) => accountId === null || r.accountId === accountId)
    .map((r) => ({ id: r.id, studentName: names.get(r.accountId) ?? '—', result: r }))
    .sort((a, b) => b.result.finishedAt - a.result.finishedAt);
}

// Экранирование ячейки CSV (RFC 4180 в минимальном виде): при запятой,
// кавычке или переносе строки значение берётся в кавычки, кавычка внутри
// удваивается. Разделитель - запятая.
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('ru-RU');
}

// CSV-выгрузка итогов: одна строка заголовков + по строке на результат.
export function resultsToCsv(rows: readonly ResultRow[]): string {
  const head = ['Ученик', 'Дата', 'Баллы', 'Отметка', 'Время (мин:сек)'];
  const lines = [head.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push([
      csvEscape(row.studentName),
      csvEscape(formatDate(row.result.finishedAt)),
      `${row.result.correct} из ${row.result.total}`,
      String(row.result.grade),
      csvEscape(formatDuration(row.result.durationSeconds)),
    ].join(','));
  }
  return lines.join('\n');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Печатная страница итогов (K5-3: «Печать»): отдельный документ с таблицей.
// Имена попадают в разметку - всё экранируется.
export function buildResultsHtml(rows: readonly ResultRow[], title: string): string {
  const body = rows
    .map((row) => `<tr><td>${escapeHtml(row.studentName)}</td><td>${escapeHtml(formatDate(row.result.finishedAt))}</td><td>${row.result.correct} из ${row.result.total}</td><td>${row.result.grade}</td><td>${escapeHtml(formatDuration(row.result.durationSeconds))}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 10px;font-size:13px;text-align:left}th{background:#eee}</style>
</head><body><h1>${escapeHtml(title)}</h1><table><thead><tr><th>Ученик</th><th>Дата</th><th>Баллы</th><th>Отметка</th><th>Время</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
}
