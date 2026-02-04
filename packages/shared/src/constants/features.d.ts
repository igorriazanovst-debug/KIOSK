export declare enum Feature {
    EditPredefinedTemplates = "edit_predefined_templates",
    BasicExport = "basic_export",
    LocalStorage = "local_storage",
    CreateCustomTemplates = "create_custom_templates",
    AdvancedExport = "advanced_export",
    CloudStorage = "cloud_storage",
    TeamCollaboration = "team_collaboration",
    PrioritySupport = "priority_support",
    CustomBranding = "custom_branding",
    ApiAccess = "api_access",
    AdvancedAnalytics = "advanced_analytics",
    DedicatedSupport = "dedicated_support",
    PlayerAutoUpdate = "player_auto_update",
    PlayerRemoteControl = "player_remote_control",
    PlayerAdvancedContent = "player_advanced_content"
}
export interface FeatureDescription {
    key: string;
    name: string;
    description: string;
    category: 'editor' | 'player' | 'cloud' | 'support';
}
export declare const FEATURE_DESCRIPTIONS: Record<Feature, FeatureDescription>;
//# sourceMappingURL=features.d.ts.map