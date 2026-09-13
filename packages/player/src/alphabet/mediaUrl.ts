// packages/player/src/alphabet/mediaUrl.ts
// Адреса файлов контента для рантайма.
//
// Пути внутри пакета строит ДОМЕН (@kiosk/shared, alphabet/model/resources),
// а превращает их в загружаемый URL — платформа. Разделение не формальное:
// путь `img/avtobus.svg` одинаков на Windows и Android, а способ его
// загрузить — нет. Экраны не должны знать ни того, ни другого.

import { alphabet } from '@kiosk/shared';
import { getAlphabetPlatform } from './platform/AlphabetPlatform';

function toUrl(assetPath: string): string {
  const platform = getAlphabetPlatform();
  // До установки платформы (первый рендер) возвращаем путь как есть: картинка
  // не загрузится, но и не уронит рендер — платформа появится следующим кадром
  return platform ? platform.assetUrl(assetPath) : assetPath;
}

export function wordImageUrl(wordId: string): string {
  return toUrl(alphabet.wordImagePath(wordId));
}

export function wordAudioUrl(wordId: string): string {
  return toUrl(alphabet.wordAudioPath(wordId));
}

export function wordWithoutLastSyllableAudioUrl(wordId: string): string {
  return toUrl(alphabet.wordWithoutLastSyllableAudioPath(wordId));
}

export function letterAudioUrl(letterNumber: number): string {
  return toUrl(alphabet.letterAudioPath(letterNumber));
}

export function syllableAudioUrl(syllableId: string): string {
  return toUrl(alphabet.syllableAudioPath(syllableId));
}
