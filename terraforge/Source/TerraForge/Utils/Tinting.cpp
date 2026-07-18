#include "Utils/Tinting.h"
#include "Components/MeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"

namespace TerraForgeTint
{

static UMaterialInterface* GetBaseMaterial()
{
	static TWeakObjectPtr<UMaterialInterface> Cached;
	if (!Cached.IsValid())
	{
		Cached = LoadObject<UMaterialInterface>(nullptr,
			TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	}
	return Cached.Get();
}

void Tint(UMeshComponent* Component, const FLinearColor& Color)
{
	if (!Component)
	{
		return;
	}

	UMaterialInterface* Base = GetBaseMaterial();
	if (!Base)
	{
		return;
	}

	UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Base, Component);
	MID->SetVectorParameterValue(TEXT("Color"), Color);

	const int32 SlotCount = FMath::Max(Component->GetNumMaterials(), 1);
	for (int32 i = 0; i < SlotCount; ++i)
	{
		Component->SetMaterial(i, MID);
	}
}

} // namespace TerraForgeTint
