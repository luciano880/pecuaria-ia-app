#include "Resources/ResourceNode.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

AResourceNode::AResourceNode()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	SetRootComponent(Mesh);
	Mesh->SetMobility(EComponentMobility::Static);

	// Placeholder: esfera achatada do engine, colorida por tipo de recurso.
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (SphereMesh.Succeeded())
	{
		Mesh->SetStaticMesh(SphereMesh.Object);
	}
	Mesh->SetRelativeScale3D(FVector(3.0f, 3.0f, 1.0f));
}

void AResourceNode::BeginPlay()
{
	Super::BeginPlay();

	if (Mesh->GetStaticMesh())
	{
		if (UMaterialInstanceDynamic* MID = Mesh->CreateAndSetMaterialInstanceDynamic(0))
		{
			MID->SetVectorParameterValue(TEXT("Color"), bIsGeyser
				? FLinearColor(0.2f, 0.8f, 0.9f) // gêiser sempre ciano
				: NodeTint);
		}
	}
}

float AResourceNode::GetPurityMultiplier() const
{
	switch (Purity)
	{
	case ENodePurity::Impure: return 0.5f;
	case ENodePurity::Pure:   return 2.0f;
	default:                  return 1.0f;
	}
}

int32 AResourceNode::Extract(int32 DesiredAmount)
{
	if (DesiredAmount <= 0 || IsDepleted())
	{
		return 0;
	}

	if (RemainingAmount < 0) // jazida infinita
	{
		return DesiredAmount;
	}

	const int32 Extracted = FMath::Min(DesiredAmount, RemainingAmount);
	RemainingAmount -= Extracted;
	return Extracted;
}
