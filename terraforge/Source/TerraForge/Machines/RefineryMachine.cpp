#include "Machines/RefineryMachine.h"

ARefineryMachine::ARefineryMachine()
{
	MachineName = NSLOCTEXT("TerraForge", "RefineryName", "Processadora Industrial");
}

bool ARefineryMachine::SetActiveRecipe(int32 RecipeIndex)
{
	if (!AvailableRecipes.IsValidIndex(RecipeIndex))
	{
		return false;
	}
	ActiveRecipeIndex = RecipeIndex;
	CycleProgress = 0.0f; // trocar de receita reinicia o ciclo atual
	return true;
}

bool ARefineryMachine::CanProduce() const
{
	if (!HasActiveRecipe())
	{
		return false;
	}
	const FProcessRecipe& Recipe = AvailableRecipes[ActiveRecipeIndex];
	if (!Recipe.IsValid())
	{
		return false;
	}

	// Todas as entradas disponíveis?
	for (const FItemStack& Input : Recipe.Inputs)
	{
		if (CountInBuffer(InputBuffer, Input.Item) < Input.Count)
		{
			return false;
		}
	}

	// Espaço para todas as saídas?
	int32 Total = 0;
	for (const FItemStack& Stack : OutputBuffer)
	{
		Total += Stack.Count;
	}
	int32 OutputCount = 0;
	for (const FItemStack& Output : Recipe.Outputs)
	{
		OutputCount += Output.Count;
	}
	return Total + OutputCount <= BufferCapacity;
}

void ARefineryMachine::ProduceCycle()
{
	const FProcessRecipe& Recipe = AvailableRecipes[ActiveRecipeIndex];

	for (const FItemStack& Input : Recipe.Inputs)
	{
		RemoveFromBuffer(InputBuffer, Input.Item, Input.Count);
	}
	for (const FItemStack& Output : Recipe.Outputs)
	{
		AddToBuffer(OutputBuffer, Output.Item, Output.Count);
	}
}
