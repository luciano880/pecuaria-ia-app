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

	// Visual: base larga + torre de perfuração + broca central que gira.
	Mesh->SetStaticMesh(nullptr);
	CreatePart("Body", CubeMeshAsset, FVector(0, 0, 60), FVector(2.2f, 2.2f, 1.2f),
		FRotator::ZeroRotator, /*bAccent*/ false);
	CreatePart("TowerLegA", CubeMeshAsset, FVector(70, 70, 200), FVector(0.18f, 0.18f, 2.2f));
	CreatePart("TowerLegB", CubeMeshAsset, FVector(-70, 70, 200), FVector(0.18f, 0.18f, 2.2f));
	CreatePart("TowerLegC", CubeMeshAsset, FVector(70, -70, 200), FVector(0.18f, 0.18f, 2.2f));
	CreatePart("TowerLegD", CubeMeshAsset, FVector(-70, -70, 200), FVector(0.18f, 0.18f, 2.2f));
	CreatePart("TowerTop", CubeMeshAsset, FVector(0, 0, 315), FVector(1.8f, 1.8f, 0.3f));
	Drill = CreatePart("Drill", CylinderMeshAsset, FVector(0, 0, 170),
		FVector(0.35f, 0.35f, 3.0f));

	// Mk1 padrão: 1 minério a cada 2 s, 5 MW, poluição leve.
	TierSpecs[0].CycleTime = 2.0f;
	TierSpecs[0].ItemsPerCycle = 1;
	TierSpecs[0].PowerConsumptionMW = 5.0f;
	TierSpecs[0].PollutionPerMinute = 1.0f;
}

void AMinerMachine::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Broca gira enquanto minera (velocidade acompanha a energia disponível).
	if (Drill && CanProduce() && GridEfficiency > 0.0f)
	{
		Drill->AddLocalRotation(FRotator(0.0f, 240.0f * DeltaSeconds * GridEfficiency, 0.0f));
	}
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
