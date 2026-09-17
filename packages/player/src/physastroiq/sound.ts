// packages/player/src/physastroiq/sound.ts
//
// Звуковая обратная связь на клик по игровому полю (предложение
// пользователя 2026-09-15). Синтезированные тона через Web Audio API, НЕ
// файлы — тот же принцип чистоты лицензий, что уже есть у изображений
// ФизАстроIQ (нарисованы программно, не сторонний материал, см.
// docs/physastroiq-third-party-licenses.md): звук не добавляет ни одного
// вопроса об авторских правах или лицензии аудиофайла.
//
// Каждый вызов создаёт СВОЙ AudioContext, а не переиспользует общий —
// намеренно просто: клики редки (раз на вопрос, не поток событий), и
// созданные узлы сами освобождаются сборщиком мусора после звучания.
// Переиспользование одного контекста потребовало бы отдельной логики
// resume() после автостоп-политики браузеров при неактивности — не
// оправдано для этого масштаба использования.

function playTone(frequencies: number[], totalDurationMs: number): void {
  if (typeof window === 'undefined') return;
  const AudioContextCtor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const ctx = new AudioContextCtor();
  const now = ctx.currentTime;
  const stepSeconds = totalDurationMs / 1000 / frequencies.length;

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    const start = now + i * stepSeconds;
    const end = start + stepSeconds;
    // Экспоненциальный спад громкости вместо резкого obрыва - иначе на
    // границе между нотами слышен щелчок.
    gain.gain.setValueAtTime(0.15, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end);
  });
}

// Восходящая трель (до-ми-соль) - узнаваемый "верно" в духе игровых шоу.
export function playCorrectTone(): void {
  playTone([523.25, 659.25, 783.99], 300);
}

// Нисходящий гудок - намеренно противоположен по направлению высоте тона
// playCorrectTone, чтобы разница была понятна на слух даже без взгляда на
// экран.
export function playWrongTone(): void {
  playTone([220, 174.61], 250);
}
