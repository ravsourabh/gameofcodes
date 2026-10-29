using UnrealBuildTool;
public class MetaHumanExportEditorTarget : TargetRules {
    public MetaHumanExportEditorTarget(TargetInfo Target) : base(Target) {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("MetaHumanExport");
    }
}
