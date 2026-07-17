#include "Machines/SmelterMachine.h"
#include "Components/StaticMeshComponent.h"

ASmelterMachine::ASmelterMachine()
{
	MachineName = NSLOCTEXT("TerraForge", "SmelterName", "Fundição");
	MachineTint = FLinearColor(0.9f, 0.45f, 0.1f); // laranja forno
	Mesh->SetRelativeScale3D(FVector(2.5f, 2.0f, 2.0f));

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
