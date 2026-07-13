#include "Machines/SmelterMachine.h"

ASmelterMachine::ASmelterMachine()
{
	MachineName = NSLOCTEXT("TerraForge", "SmelterName", "Fundição");
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
