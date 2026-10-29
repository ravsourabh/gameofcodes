#include "WebAvatarExportLibrary.h"
#include "Modules/ModuleManager.h"
#include "Engine/SkeletalMesh.h"
#include "Animation/AnimSequence.h"
#include "Animation/PoseAsset.h"
#include "Animation/AnimInstance.h"
#include "Components/SkeletalMeshComponent.h"
#include "PreviewScene.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/PackageName.h"
IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, MetaHumanExport, "MetaHumanExport");

bool UWebAvatarExportLibrary::MountSourceContent(const FString& PluginDirectory) {
    if(!FPaths::FileExists(FPaths::Combine(PluginDirectory,TEXT("MetaHumanCrowdContent.uplugin")))) return false;
    FString Content=FPaths::Combine(PluginDirectory,TEXT("Content"));FPaths::NormalizeDirectoryName(Content);
    FPackageName::RegisterMountPoint(TEXT("/MetaHumanCrowdContent/"),Content+TEXT("/"));return true;
}

static TSharedPtr<FJsonValue> TransformJson(const FTransform& T) {
    const FVector P=T.GetTranslation(), S=T.GetScale3D(); const FQuat Q=T.GetRotation();
    TArray<TSharedPtr<FJsonValue>> V;
    for(double X: {P.X,P.Y,P.Z,Q.X,Q.Y,Q.Z,Q.W,S.X,S.Y,S.Z}) V.Add(MakeShared<FJsonValueNumber>(X));
    return MakeShared<FJsonValueArray>(V);
}
bool UWebAvatarExportLibrary::ExportFacialPoses(USkeletalMesh* Mesh, UAnimSequence* Animation, UPoseAsset* PoseNames, const FString& OutputFile) {
    if(!Mesh || !Animation || !PoseNames) return false;
    FPreviewScene Preview(FPreviewScene::ConstructionValues().SetCreatePhysicsScene(false).ShouldSimulatePhysics(false));
    USkeletalMeshComponent* C=NewObject<USkeletalMeshComponent>();
    C->SetSkeletalMesh(Mesh); C->SetForcedLOD(1); C->bEnableUpdateRateOptimizations=false;
    Preview.AddComponent(C,FTransform::Identity);
    C->SetAnimationMode(EAnimationMode::AnimationSingleNode); C->SetAnimation(Animation);
    C->InitAnim(true); C->SetAnimation(Animation); C->Stop(); C->SetAllowAnimCurveEvaluation(true);
    const TArray<FName>& Names=PoseNames->GetPoseFNames();
    TSharedRef<FJsonObject> Root=MakeShared<FJsonObject>();
    Root->SetStringField("mesh",Mesh->GetPathName());Root->SetStringField("animation",Animation->GetPathName());
    Root->SetStringField("coordinateSystem","Unreal centimetres, component-space bone transforms");
    TArray<TSharedPtr<FJsonValue>> Bones, Parents, Rest, Frames;
    const FReferenceSkeleton& Ref=Mesh->GetRefSkeleton();
    for(int32 I=0; I<Ref.GetNum(); ++I) {Bones.Add(MakeShared<FJsonValueString>(Ref.GetBoneName(I).ToString()));Parents.Add(MakeShared<FJsonValueNumber>(Ref.GetParentIndex(I)));Rest.Add(TransformJson(Ref.GetRefBonePose()[I]));}
    Root->SetArrayField("bones",Bones);Root->SetArrayField("parents",Parents);Root->SetArrayField("referenceLocal",Rest);
    Root->SetNumberField("animationFrames",Animation->GetNumberOfSampledKeys());
    for(int32 Frame=0; Frame<Names.Num(); ++Frame) {
        const double Time=Animation->GetTimeAtFrame(Frame);
        C->SetPosition(Time,false); C->TickAnimation(0.f,false); C->RefreshBoneTransforms();
        const TArray<FTransform>& Transforms=C->GetComponentSpaceTransforms();
        TArray<TSharedPtr<FJsonValue>> Values;for(const FTransform& T:Transforms) Values.Add(TransformJson(T));
        TSharedRef<FJsonObject> Item=MakeShared<FJsonObject>();Item->SetStringField("name",Names[Frame].ToString());Item->SetNumberField("time",Time);Item->SetArrayField("componentSpace",Values);
        Frames.Add(MakeShared<FJsonValueObject>(Item));
        UE_LOG(LogTemp,Display,TEXT("WEBAVATAR_POSE %d %s bones=%d"),Frame,*Names[Frame].ToString(),Transforms.Num());
    }
    Root->SetArrayField("poses",Frames);
    FString Json;auto Writer=TJsonWriterFactory<>::Create(&Json);FJsonSerializer::Serialize(Root,Writer);
    return FFileHelper::SaveStringToFile(Json,*OutputFile,FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}
