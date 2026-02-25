// packages/shared/src/constants/plans.ts

import { Plan } from '../types';

export interface PlanConfig {
  name: string;
  displayName: string;
  seatsEditor: number;
  seatsPlayer: number;
  features: string[];
  priceMonthly?: number; // USD
  priceYearly?: number; // USD
}

export const PLAN_CONFIGS: Record<Plan, PlanConfig> = {
  [Plan.Basic]: {
    name: 'basic',
    displayName: 'Basic',
    seatsEditor: 1,
    seatsPlayer: 3,
    features: [
      'edit_predefined_templates',
      'basic_export',
      'local_storage'
    ],
    priceMonthly: 29,
    priceYearly: 290
  },
  
  [Plan.Pro]: {
    name: 'pro',
    displayName: 'Pro',
    seatsEditor: 5,
    seatsPlayer: 10,
    features: [
      'edit_predefined_templates',
      'create_custom_templates',
      'advanced_export',
      'cloud_storage',
      'team_collaboration',
      'priority_support'
    ],
    priceMonthly: 99,
    priceYearly: 990
  },
  
  [Plan.Max]: {
    name: 'max',
    displayName: 'Max',
    seatsEditor: 20,
    seatsPlayer: 50,
    features: [
      'edit_predefined_templates',
      'create_custom_templates',
      'advanced_export',
      'cloud_storage',
      'team_collaboration',
      'priority_support',
      'custom_branding',
      'api_access',
      'advanced_analytics',
      'dedicated_support'
    ],
    priceMonthly: 299,
    priceYearly: 2990
  }
};

export function getPlanConfig(plan: Plan): PlanConfig {
  return PLAN_CONFIGS[plan];
}

export function getPlanFeatures(plan: Plan): string[] {
  return PLAN_CONFIGS[plan].features;
}

export function hasPlanFeature(plan: Plan, feature: string): boolean {
  return PLAN_CONFIGS[plan].features.includes(feature);
}
