#include "Machines/SmelterMachine.h"
#include "Components/StaticMeshComponent.h"

ASmelterMachine::ASmelterMachine()
{
	MachineName = NSLOCTEXT("TerraForge", "SmelterName", "Fundição");
	MachineTint = FLinearColor(0.9f, 0.45f, 0.1f); // laranja forno

	// Visual: forno com porta frontal e chaminé alta no fundo.
	Mesh->SetStaticMesh(nullptr);
	CreatePart("Body", CubeMeshAsset, FVector(0, 0, 100), FVector(2.5f, 2.0f, 2.0f),
		FRotator::ZeroRotator, /*bAccent*/ false);
	CreatePart("Door", CubeMeshAsset, FVector(128, 0, 70), FVector(0.08f, 1.0f, 1.1f));
	CreatePart("Chimney", CylinderMeshAsset, FVector(-80, 60, 320), FVector(0.5f, 0.5f, 2.8f));
	CreatePart("ChimneyCap", CylinderMeshAsset, FVector(-80, 60, 465),
		FVector(0.65f, 0.65f, 0.2f));

	TierSpecs[0].CycleTime = 3.0f;
	TierSpecs[0].ItemsPerCycle = 1;
	TierSpecs[0].PowerConsumptionMW = 8.0f;
	TierSpecs[0].PollutionPerMinute = 2.0f;
}

bool ASmelterMachine::CanProduce() const
{
	if (!ActiveRecipe.InputItem || !ActiveRecipe.OutputItem)
	{
		return false;
	}

	if (CountInBuffer(InputBuffer, ActiveRecipe.InputItem) < ActiveRecipe.InputCount)
	{
		return false;
	}

	int32 Total = 0;
	for (const FItemStack& Stack : OutputBuffer)
	{
		Total += Stack.Count;
	}
	return Total + ActiveRecipe.OutputCount <= BufferCapacity;
}

void ASmelterMachine::ProduceCycle()
{
	RemoveFromBuffer(InputBuffer, ActiveRecipe.InputItem, ActiveRecipe.InputCount);
	AddToBuffer(OutputBuffer, ActiveRecipe.OutputItem, ActiveRecipe.OutputCount);
}
