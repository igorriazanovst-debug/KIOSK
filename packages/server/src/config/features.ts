// packages/server/src/config/features.ts

import { Plan, Feature, getPlanFeatures } from '@kiosk/shared';

/**
 * Получить список features для плана
 */
export function getFeaturesForPlan(plan: Plan): string[] {
  return getPlanFeatures(plan);
}

/**
 * Проверить есть ли feature в плане
 */
export function planHasFeature(plan: Plan, feature: string): boolean {
  const features = getFeaturesForPlan(plan);
  return features.includes(feature);
}

/**
 * Получить дополнительные features для плеера
 * (зависят от плана organization)
 */
export function getPlayerFeatures(plan: Plan): string[] {
  const baseFeatures: string[] = [];
  
  // Pro и Max получают автообновления
  if (plan === Plan.Pro || plan === Plan.Max) {
    baseFeatures.push(Feature.PlayerAutoUpdate);
    baseFeatures.push(Feature.PlayerRemoteControl);
  }
  
  // Max получает расширенный контент
  if (plan === Plan.Max) {
    baseFeatures.push(Feature.PlayerAdvancedContent);
  }
  
  return baseFeatures;
}

/**
 * Получить все features (editor + player) для токена
 */
export function getAllFeaturesForToken(plan: Plan, appType: 'EDITOR' | 'PLAYER'): string[] {
  const editorFeatures = getFeaturesForPlan(plan);
  
  if (appType === 'PLAYER') {
    const playerFeatures = getPlayerFeatures(plan);
    return [...editorFeatures, ...playerFeatures];
  }
  
  return editorFeatures;
}
