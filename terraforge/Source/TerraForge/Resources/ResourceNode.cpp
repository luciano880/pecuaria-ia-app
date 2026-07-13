#include "Resources/ResourceNode.h"
#include "Components/StaticMeshComponent.h"

AResourceNode::AResourceNode()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	SetRootComponent(Mesh);
	Mesh->SetMobility(EComponentMobility::Static);
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
