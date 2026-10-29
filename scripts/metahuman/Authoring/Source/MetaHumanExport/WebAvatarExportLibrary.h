#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "WebAvatarExportLibrary.generated.h"
class USkeletalMesh;
class UAnimSequence;
class UPoseAsset;
UCLASS()
class METAHUMANEXPORT_API UWebAvatarExportLibrary : public UBlueprintFunctionLibrary {
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="WebAvatarExport")
    static bool MountSourceContent(const FString& PluginDirectory);
    // Evaluates Epic's own post-process RigLogic before recording facial poses.
    UFUNCTION(BlueprintCallable, Category="WebAvatarExport")
    static bool ExportFacialPoses(USkeletalMesh* Mesh, UAnimSequence* Animation, UPoseAsset* PoseNames, const FString& OutputFile);
};
