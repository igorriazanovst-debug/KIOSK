"use strict";
// packages/shared/src/constants/features.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_DESCRIPTIONS = exports.Feature = void 0;
var Feature;
(function (Feature) {
    // Basic features (все планы)
    Feature["EditPredefinedTemplates"] = "edit_predefined_templates";
    Feature["BasicExport"] = "basic_export";
    Feature["LocalStorage"] = "local_storage";
    // Pro+ features
    Feature["CreateCustomTemplates"] = "create_custom_templates";
    Feature["AdvancedExport"] = "advanced_export";
    Feature["CloudStorage"] = "cloud_storage";
    Feature["TeamCollaboration"] = "team_collaboration";
    Feature["PrioritySupport"] = "priority_support";
    // Max features
    Feature["CustomBranding"] = "custom_branding";
    Feature["ApiAccess"] = "api_access";
    Feature["AdvancedAnalytics"] = "advanced_analytics";
    Feature["DedicatedSupport"] = "dedicated_support";
    // Player features
    Feature["PlayerAutoUpdate"] = "player_auto_update";
    Feature["PlayerRemoteControl"] = "player_remote_control";
    Feature["PlayerAdvancedContent"] = "player_advanced_content";
})(Feature || (exports.Feature = Feature = {}));
exports.FEATURE_DESCRIPTIONS = {
    [Feature.EditPredefinedTemplates]: {
        key: 'edit_predefined_templates',
        name: 'Edit Predefined Templates',
        description: 'Edit content in pre-made templates',
        category: 'editor'
    },
    [Feature.BasicExport]: {
        key: 'basic_export',
        name: 'Basic Export',
        description: 'Export projects as standalone apps',
        category: 'editor'
    },
    [Feature.LocalStorage]: {
        key: 'local_storage',
        name: 'Local Storage',
        description: 'Save projects locally',
        category: 'editor'
    },
    [Feature.CreateCustomTemplates]: {
        key: 'create_custom_templates',
        name: 'Custom Templates',
        description: 'Create your own templates from scratch',
        category: 'editor'
    },
    [Feature.AdvancedExport]: {
        key: 'advanced_export',
        name: 'Advanced Export',
        description: 'Export with custom branding and settings',
        category: 'editor'
    },
    [Feature.CloudStorage]: {
        key: 'cloud_storage',
        name: 'Cloud Storage',
        description: 'Save and sync projects in the cloud',
        category: 'cloud'
    },
    [Feature.TeamCollaboration]: {
        key: 'team_collaboration',
        name: 'Team Collaboration',
        description: 'Share projects with team members',
        category: 'cloud'
    },
    [Feature.PrioritySupport]: {
        key: 'priority_support',
        name: 'Priority Support',
        description: '24/7 priority customer support',
        category: 'support'
    },
    [Feature.CustomBranding]: {
        key: 'custom_branding',
        name: 'Custom Branding',
        description: 'Remove branding and add your own',
        category: 'editor'
    },
    [Feature.ApiAccess]: {
        key: 'api_access',
        name: 'API Access',
        description: 'Programmatic access to platform features',
        category: 'cloud'
    },
    [Feature.AdvancedAnalytics]: {
        key: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Detailed usage analytics and reports',
        category: 'cloud'
    },
    [Feature.DedicatedSupport]: {
        key: 'dedicated_support',
        name: 'Dedicated Support',
        description: 'Dedicated account manager',
        category: 'support'
    },
    [Feature.PlayerAutoUpdate]: {
        key: 'player_auto_update',
        name: 'Player Auto-Update',
        description: 'Automatic updates for player apps',
        category: 'player'
    },
    [Feature.PlayerRemoteControl]: {
        key: 'player_remote_control',
        name: 'Remote Control',
        description: 'Control players remotely',
        category: 'player'
    },
    [Feature.PlayerAdvancedContent]: {
        key: 'player_advanced_content',
        name: 'Advanced Content',
        description: 'Support for advanced content types',
        category: 'player'
    }
};
