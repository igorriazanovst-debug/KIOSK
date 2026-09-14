// packages/player/src/inophone/audio.ts
// Произношение слов.
//
// ОДИН ЗВУК ЗА РАЗ. Наложение произношений — не украшение, а прямая помеха:
// ученик слышит два слова сразу и не понимает, какое из них загадано. Поэтому
// предыдущее воспроизведение прерывается, а не смешивается с новым.
//
// МОЛЧАНИЕ — ШТАТНОЕ СОСТОЯНИЕ, а не ошибка. Озвучка есть не на всех языках
// (см. план, раздел 0.3), и `hasAudio: false` — честное «звук не записан».
// Ронять экран из-за отсутствующего файла значило бы сделать пособие
// непригодным ровно там, где оно нужнее всего.

import type { LanguageCode } from './types';
import { conceptAudioUrl } from './mediaUrl';

let current: HTMLAudioElement | null = null;

export function stopSpeech(): void {
  if (!current) return;
  current.pause();
  current = null;
}

export interface SpeakOptions {
  /** Громкость 0..100 из настроек занятия */
  volume: number;
}

/**
 * Произнести слово на языке. Возвращает обещание, которое исполняется по
 * окончании — или сразу, если звука нет.
 *
 * `hasAudio` спрашивается У ВЫЗЫВАЮЩЕГО, а не выводится из неудачной загрузки:
 * отличить «файла нет» от «файл не успел загрузиться» по событию `error`
 * нельзя, а разница существенна — первое чинит диктор, второе никто.
 */
export function speak(
  conceptId: string,
  code: LanguageCode,
  hasAudio: boolean,
  options: SpeakOptions
): Promise<void> {
  stopSpeech();
  if (!hasAudio) return Promise.resolve();

  const el = new Audio(conceptAudioUrl(conceptId, code));
  el.volume = Math.min(1, Math.max(0, options.volume / 100));
  current = el;

  return new Promise<void>((resolve) => {
    const done = () => {
      if (current === el) current = null;
      resolve();
    };
    el.onended = done;
    // Неудача — тоже завершение: экран не должен ждать звука, которого нет
    el.onerror = done;
    void el.play().catch(done);
  });
}

/**
 * Произнести слово подряд на нескольких языках.
 *
 * Нужно в обучении: ученик щёлкнул по объекту и слышит его на всех изучаемых
 * языках один за другим. Последовательно, а не разом — см. правило выше.
 */
export async function speakSequence(
  items: readonly { conceptId: string; code: LanguageCode; hasAudio: boolean }[],
  options: SpeakOptions
): Promise<void> {
  for (const item of items) {
    await speak(item.conceptId, item.code, item.hasAudio, options);
  }
}
