#include "Machines/MinerMachine.h"
#include "Components/StaticMeshComponent.h"
#include "Resources/ResourceNode.h"
#include "Items/ItemData.h"
#include "EngineUtils.h"
#include "TerraForge.h"

AMinerMachine::AMinerMachine()
{
	MachineName = NSLOCTEXT("TerraForge", "MinerName", "Mineradora");
	MachineTint = FLinearColor(0.15f, 0.35f, 0.8f); // azul aço
	Mesh->SetRelativeScale3D(FVector(2.0f, 2.0f, 1.5f));

	// Mk1 padrão: 1 minério a cada 2 s, 5 MW, poluição leve.
	TierSpecs[0].CycleTime = 2.0f;
	TierSpecs[0].ItemsPerCycle = 1;
	TierSpecs[0].PowerConsumptionMW = 5.0f;
	TierSpecs[0].PollutionPerMinute = 1.0f;
}

void AMinerMachine::BeginPlay()
{
	Super::BeginPlay();

	if (!TargetNode)
	{
		FindTargetNode();
	}

	if (!TargetNode)
	{
		UE_LOG(LogTerraForge, Warning, TEXT("%s: nenhuma jazida encontrada em %.0f uu"),
			*GetName(), NodeSearchRadius);
	}
}

void AMinerMachine::FindTargetNode()
{
	float BestDistSq = FMath::Square(NodeSearchRadius);
	for (TActorIterator<AResourceNode> It(GetWorld()); It; ++It)
	{
		const float DistSq = FVector::DistSquared(It->GetActorLocation(), GetActorLocation());
		if (DistSq <= BestDistSq)
		{
			BestDistSq = DistSq;
			TargetNode = *It;
		}
	}
}

bool AMinerMachine::CanProduce() const
{
	if (!TargetNode || !TargetNode->OreType || TargetNode->IsDepleted())
	{
		return false;
	}

	// Para de minerar com o buffer de saída cheio (backpressure da fábrica).
	int32 Total = 0;
	for (const FItemStack& Stack : OutputBuffer)
	{
		Total += Stack.Count;
	}
	return Total < BufferCapacity;
}

void AMinerMachine::ProduceCycle()
{
	const FMachineTierSpec& Spec = GetCurrentSpec();
	const int32 Desired = FMath::Max(1,
		FMath::RoundToInt32(Spec.ItemsPerCycle * TargetNode->GetPurityMultiplier()));

	const int32 Extracted = TargetNode->Extract(Desired);
	if (Extracted > 0)
	{
		AddToBuffer(OutputBuffer, TargetNode->OreType, Extracted);
	}
}
