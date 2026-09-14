// packages/shared/src/inophone/game/presentation.ts
// Как подаётся загаданное слово в тренировке и соревновании.
//
// ТЗ строка 89 говорит дословно: программа «называет (или подписывает, или оба
// варианта сразу) объекты». Три допустимых сочетания из четырёх — выключить
// оба способа нельзя, иначе ученику нечего искать: он не знает, что загадано.
//
// У эталона это же правило зашито в обработчик переключателя:
//
//     toggleAllowText() {
//         this.allowText = !this.allowText;
//         if (this.allowText === false && this.allowAudio === false) this.allowAudio = true;
//     }
//
// Здесь оно вынесено в чистую функцию и покрыто тестами: правило «нельзя
// выключить оба» — не деталь вёрстки, а условие осмысленности режима, и жить
// оно должно там, где его видно.

export interface Presentation {
  /** Произносить загаданное слово */
  audio: boolean;
  /** Показывать написание загаданного слова */
  text: boolean;
}

export const DEFAULT_PRESENTATION: Presentation = { audio: true, text: true };

/**
 * Переключить способ подачи.
 *
 * Если выключается последний включённый — второй включается автоматически.
 * Возвращается новое значение, переданное не меняется.
 */
export function togglePresentation(current: Presentation, what: keyof Presentation): Presentation {
  const next: Presentation = { ...current, [what]: !current[what] };
  if (!next.audio && !next.text) {
    // Включаем ДРУГОЙ способ, а не тот, что выключали: иначе нажатие не
    // давало бы никакого видимого эффекта, и пользователь решил бы, что
    // переключатель сломан
    const other: keyof Presentation = what === 'audio' ? 'text' : 'audio';
    next[other] = true;
  }
  return next;
}

/** Годится ли набор для игры: хотя бы один способ подачи включён */
export function isPresentationUsable(p: Presentation): boolean {
  return p.audio || p.text;
}
