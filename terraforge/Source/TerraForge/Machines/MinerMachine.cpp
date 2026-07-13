#include "Machines/MinerMachine.h"
#include "Resources/ResourceNode.h"
#include "Items/ItemData.h"
#include "EngineUtils.h"
#include "TerraForge.h"

AMinerMachine::AMinerMachine()
{
	MachineName = NSLOCTEXT("TerraForge", "MinerName", "Mineradora");
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
