"use strict";
// packages/shared/src/constants/plans.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_CONFIGS = void 0;
exports.getPlanConfig = getPlanConfig;
exports.getPlanFeatures = getPlanFeatures;
exports.hasPlanFeature = hasPlanFeature;
const types_1 = require("../types");
exports.PLAN_CONFIGS = {
    [types_1.Plan.Basic]: {
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
    [types_1.Plan.Pro]: {
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
    [types_1.Plan.Max]: {
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
function getPlanConfig(plan) {
    return exports.PLAN_CONFIGS[plan];
}
function getPlanFeatures(plan) {
    return exports.PLAN_CONFIGS[plan].features;
}
function hasPlanFeature(plan, feature) {
    return exports.PLAN_CONFIGS[plan].features.includes(feature);
}
//# sourceMappingURL=plans.js.map