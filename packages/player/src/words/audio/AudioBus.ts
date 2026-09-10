// packages/player/src/words/audio/AudioBus.ts
// Очередь озвучки: реплики произносятся последовательно, а не наслаиваются.
//
// Главное здесь — отбрасывание запоздалого звука по roundId. Реплика,
// начатая в предыдущей партии, доигрывает уже после выхода в меню и
// произносит чужое слово поверх новой партии. У эталона ОС3 этот механизм
// назван roomId — приём неочевидный, но без него баг воспроизводится каждый
// раз, когда ребёнок выходит из темы не дослушав.
//
// Проигрыватель внедряется снаружи (SoundPlayer), поэтому вся логика
// очереди и отбрасывания тестируется без браузера и без реальных файлов.

export interface SoundPlayer {
  /** Проигрывает один файл до конца. Отсутствующий файл — не ошибка, см. ниже */
  play(url: string): Promise<void>;
  stop(): void;
  setVolume(volume01: number): void;
}

export class AudioBus {
  private queue: Promise<void> = Promise.resolve();
  private currentRound: string | null = null;
  private volume01 = 0.7;
  // Поле объявлено явно, а не параметром конструктора: параметр-свойство
  // требует генерации кода, а тесты гоняются в режиме «только вырезать типы»
  // (node --experimental-strip-types) и такой синтаксис не принимают.
  private readonly player: SoundPlayer;

  constructor(player: SoundPlayer) {
    this.player = player;
  }

  /**
   * Начать новую партию (или экран). Всё, что было поставлено в очередь для
   * прошлого раунда, доигрывать не будет.
   */
  startRound(roundId: string): void {
    this.currentRound = roundId;
    this.player.stop();
  }

  /** Громкость 0..100 — так она хранится в настройках и приходит из виджета */
  setVolume(volume0to100: number): void {
    const clamped = Math.min(100, Math.max(0, volume0to100));
    this.volume01 = clamped / 100;
    this.player.setVolume(this.volume01);
  }

  get volume(): number {
    return Math.round(this.volume01 * 100);
  }

  /**
   * Поставить реплику (одну или цепочку) в очередь. Возвращает промис,
   * который резолвится, когда реплика доиграна ИЛИ отброшена как запоздалая.
   */
  say(urls: string[], roundId: string): Promise<void> {
    const task = this.queue.then(async () => {
      if (roundId !== this.currentRound) return; // раунд сменился, пока ждали очереди
      for (const url of urls) {
        if (roundId !== this.currentRound) return; // сменился между файлами цепочки
        try {
          await this.player.play(url);
        } catch {
          // Отсутствующий или битый файл озвучки не должен ронять занятие:
          // пакет контента может быть без звука (он производится отдельно),
          // и молчаливая карточка лучше, чем сорванный урок.
        }
      }
    });
    this.queue = task;
    return task;
  }

  /** Оборвать всё: выход с экрана, пауза, закрытие окна */
  stop(): void {
    this.currentRound = null;
    this.player.stop();
  }
}

/** Реальный проигрыватель поверх одного общего Audio — как у эталона */
export function createHtmlAudioPlayer(): SoundPlayer {
  const audio = new Audio();
  return {
    play(url: string) {
      return new Promise<void>((resolve, reject) => {
        const done = () => {
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', fail);
          resolve();
        };
        const fail = () => {
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', fail);
          reject(new Error(`audio failed: ${url}`));
        };
        audio.addEventListener('ended', done);
        audio.addEventListener('error', fail);
        audio.src = url;
        audio.play().catch(fail);
      });
    },
    stop() {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
    setVolume(v: number) {
      audio.volume = Math.min(1, Math.max(0, v));
    },
  };
}
