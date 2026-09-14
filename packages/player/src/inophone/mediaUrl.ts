// packages/player/src/inophone/mediaUrl.ts
// Адреса файлов контента для рантайма.
//
// Пути внутри пакета строит ДОМЕН (@kiosk/shared, inophone/model/resources),
// а превращает их в загружаемый URL — платформа. Разделение не формальное:
// путь `audio/fr/bed.mp3` одинаков на Windows и Android, а способ его
// загрузить — нет. Экраны не должны знать ни того, ни другого.

import { inophone } from '@kiosk/shared';
import type { LanguageCode } from './types';
import { getInophonePlatform } from './platform/InophonePlatform';

function toUrl(assetPath: string): string {
  const platform = getInophonePlatform();
  // До установки платформы (первый рендер) возвращаем путь как есть: картинка
  // не загрузится, но и не уронит рендер — платформа появится следующим кадром
  return platform ? platform.assetUrl(assetPath) : assetPath;
}

export function sceneImageUrl(sceneId: string): string {
  return toUrl(inophone.sceneImagePath(sceneId));
}

export function conceptImageUrl(conceptId: string): string {
  return toUrl(inophone.conceptImagePath(conceptId));
}

export function conceptAudioUrl(conceptId: string, code: LanguageCode): string {
  return toUrl(inophone.conceptAudioPath(conceptId, code));
}
