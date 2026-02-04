import { Plan } from '../types';
export interface PlanConfig {
    name: string;
    displayName: string;
    seatsEditor: number;
    seatsPlayer: number;
    features: string[];
    priceMonthly?: number;
    priceYearly?: number;
}
export declare const PLAN_CONFIGS: Record<Plan, PlanConfig>;
export declare function getPlanConfig(plan: Plan): PlanConfig;
export declare function getPlanFeatures(plan: Plan): string[];
export declare function hasPlanFeature(plan: Plan, feature: string): boolean;
//# sourceMappingURL=plans.d.ts.map