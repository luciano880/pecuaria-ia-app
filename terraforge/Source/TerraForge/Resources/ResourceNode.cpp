#include "Resources/ResourceNode.h"
#include "Items/ItemData.h"
#include "Components/StaticMeshComponent.h"
#include "Utils/Tinting.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	const FLinearColor DefaultNodeTint(0.55f, 0.3f, 0.2f);
}

AResourceNode::AResourceNode()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	SetRootComponent(Mesh);
	Mesh->SetMobility(EComponentMobility::Static);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(
		TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));

	// Monte principal achatado + pedaços menores (aglomerado de minério).
	if (SphereMesh.Succeeded())
	{
		Mesh->SetStaticMesh(SphereMesh.Object);
	}
	Mesh->SetRelativeScale3D(FVector(3.0f, 3.0f, 1.0f));

	// Escalas/posições relativas compensam a escala (3,3,1) do monte.
	const FVector Offsets[] = { FVector(30, 17, 25), FVector(-23, -27, 18) };
	const FVector Scales[] = { FVector(0.37f, 0.37f, 0.8f), FVector(0.27f, 0.27f, 0.6f) };
	for (int32 i = 0; i < 2; ++i)
	{
		UStaticMeshComponent* Chunk = CreateDefaultSubobject<UStaticMeshComponent>(
			*FString::Printf(TEXT("Chunk%d"), i));
		Chunk->SetupAttachment(Mesh);
		Chunk->SetMobility(EComponentMobility::Static);
		if (SphereMesh.Succeeded())
		{
			Chunk->SetStaticMesh(SphereMesh.Object);
		}
		Chunk->SetRelativeLocation(Offsets[i]);
		Chunk->SetRelativeScale3D(Scales[i]);
		Chunks.Add(Chunk);
	}

	// Coluna de vapor do gêiser (escondida por padrão).
	Steam = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Steam"));
	Steam->SetupAttachment(Mesh);
	Steam->SetMobility(EComponentMobility::Static);
	if (CylinderMesh.Succeeded())
	{
		Steam->SetStaticMesh(CylinderMesh.Object);
	}
	Steam->SetRelativeLocation(FVector(0, 0, 260));
	Steam->SetRelativeScale3D(FVector(0.15f, 0.15f, 5.0f));
	Steam->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Steam->SetVisibility(false);
}

FLinearColor AResourceNode::ResolveTint() const
{
	// Gêiser é sempre ciano.
	if (bIsGeyser)
	{
		return FLinearColor(0.2f, 0.8f, 0.9f);
	}

	// Se o designer mudou a cor à mão, respeita.
	if (!NodeTint.Equals(DefaultNodeTint))
	{
		return NodeTint;
	}

	// Cor automática pelo id do item (itens criados pelo UGameDataSubsystem).
	if (OreType)
	{
		const FName Id = OreType->GetFName();
		if (Id == "MinerioFerro")  return FLinearColor(0.32f, 0.14f, 0.08f); // ferrugem escura
		if (Id == "MinerioCobre")  return FLinearColor(0.08f, 0.35f, 0.28f);
		if (Id == "Carvao")        return FLinearColor(0.04f, 0.04f, 0.05f);
		if (Id == "Calcario")      return FLinearColor(0.62f, 0.6f, 0.52f);
	}
	return NodeTint;
}

void AResourceNode::BeginPlay()
{
	Super::BeginPlay();

	const FLinearColor Tint = ResolveTint();
	auto Paint = [](UStaticMeshComponent* Component, const FLinearColor& Color)
	{
		if (Component && Component->GetStaticMesh())
		{
			TerraForgeTint::Tint(Component, Color);
		}
	};

	Paint(Mesh, Tint);
	for (UStaticMeshComponent* Chunk : Chunks)
	{
		Paint(Chunk, Tint * 0.7f); // pedaços mais escuros (minério exposto)
	}

	if (bIsGeyser)
	{
		Steam->SetVisibility(true);
		Paint(Steam, FLinearColor(0.95f, 0.97f, 1.0f));
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
