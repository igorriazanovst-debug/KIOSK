// Локальные данные пользователей ЭУМК: учётные записи, результаты тестов,
// прогресс по заданиям. Хранилище - localStorage профиля приложения (у
// каждого установленного приложения свой профиль, значит, у каждого
// комплекса свои данные). Все функции изменения возвращают новый объект.

import { EumkUserDataSchema, emptyUserData, type Account, type EumkUserData, type TestResult } from './model/schema.ts';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function storageKey(contentId: string): string {
  return `eumk:userdata:${contentId}`;
}

export type LoadStatus = 'ok' | 'empty' | 'corrupt';

export interface LoadedUserData {
  status: LoadStatus;
  data: EumkUserData;
}

// Повреждённые данные не подменяются молча пустыми: интерфейс обязан
// показать предупреждение, иначе потеря статистики выглядит как «ещё не
// проходили тест».
export function loadUserData(storage: KeyValueStorage, contentId: string): LoadedUserData {
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(contentId));
  } catch {
    return { status: 'corrupt', data: emptyUserData() };
  }
  if (raw === null) return { status: 'empty', data: emptyUserData() };
  try {
    return { status: 'ok', data: EumkUserDataSchema.parse(JSON.parse(raw)) };
  } catch {
    return { status: 'corrupt', data: emptyUserData() };
  }
}

export function saveUserData(storage: KeyValueStorage, contentId: string, data: EumkUserData): boolean {
  try {
    storage.setItem(storageKey(contentId), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function newId(prefix: string, now: number): string {
  return `${prefix}-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function addAccount(data: EumkUserData, name: string, now: number): { data: EumkUserData; account: Account } {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed === '') throw new Error('Введите имя');
  const lower = trimmed.toLowerCase();
  if (data.accounts.some((a) => a.name.toLowerCase() === lower)) throw new Error('Такая учётная запись уже есть');
  const account: Account = { id: newId('acc', now), name: trimmed, createdAt: now };
  return { data: { ...data, accounts: [...data.accounts, account] }, account };
}

export function removeAccount(data: EumkUserData, accountId: string): EumkUserData {
  const { [accountId]: _removed, ...progress } = data.taskProgress;
  return {
    ...data,
    accounts: data.accounts.filter((a) => a.id !== accountId),
    results: data.results.filter((r) => r.accountId !== accountId),
    taskProgress: progress,
  };
}

export function recordResult(data: EumkUserData, result: TestResult): EumkUserData {
  return { ...data, results: [...data.results, result] };
}

export function signaturesFor(data: EumkUserData, accountId: string): string[] {
  return data.results.filter((r) => r.accountId === accountId).map((r) => r.signature);
}

export function resultsFor(data: EumkUserData, accountId: string): TestResult[] {
  return data.results.filter((r) => r.accountId === accountId).sort((a, b) => b.finishedAt - a.finishedAt);
}

export function markTask(data: EumkUserData, accountId: string, taskId: string, done: boolean): EumkUserData {
  return {
    ...data,
    taskProgress: { ...data.taskProgress, [accountId]: { ...(data.taskProgress[accountId] ?? {}), [taskId]: done } },
  };
}

export function newResultId(now: number): string {
  return newId('res', now);
}
