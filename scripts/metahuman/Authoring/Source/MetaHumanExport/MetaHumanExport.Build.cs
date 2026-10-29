using UnrealBuildTool;
public class MetaHumanExport : ModuleRules {
    public MetaHumanExport(ReadOnlyTargetRules Target) : base(Target) {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[]{"Core","CoreUObject","Engine"});
        PrivateDependencyModuleNames.AddRange(new string[]{"UnrealEd","Json","RigLogicModule","RigLogicEditor"});
    }
}
