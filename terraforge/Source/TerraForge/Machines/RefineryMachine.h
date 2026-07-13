#pragma once

#include "CoreMinimal.h"
#include "Machines/MachineBase.h"
#include "RefineryMachine.generated.h"

/**
 * Receita industrial com múltiplas entradas e múltiplas saídas.
 * Exemplos (configurar como Data Assets / Blueprints):
 *   Alto-forno:  3x Minério de Ferro + 1x Carvão + 1x Calcário -> 2x Ferro-gusa + 1x Escória
 *   Refinaria:   3x Petróleo Cru -> 2x Óleo Combustível + 2x Nafta + 1x Betume
 *   Planta quím: 2x Nafta -> 3x Plástico
 *   Eletrólise:  2x Alumina -> 1x Alumínio (alto consumo de MW no TierSpec)
 */
USTRUCT(BlueprintType)
struct TERRAFORGE_API FProcessRecipe
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	FText RecipeName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TArray<FItemStack> Inputs;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TArray<FItemStack> Outputs;

	bool IsValid() const { return Inputs.Num() > 0 && Outputs.Num() > 0; }
};

/**
 * Máquina de processo industrial genérica: consome todas as entradas da receita
 * ativa por ciclo e produz todas as saídas. Base para alto-forno, aciaria,
 * refinaria de petróleo, planta química, eletrólise, forno de silício etc.
 */
UCLASS()
class TERRAFORGE_API ARefineryMachine : public AMachineBase
{
	GENERATED_BODY()

public:
	ARefineryMachine();

	/** Receitas que esta máquina sabe executar (definidas no Blueprint filho). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Refinery")
	TArray<FProcessRecipe> AvailableRecipes;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Refinery")
	int32 ActiveRecipeIndex = 0;

	UFUNCTION(BlueprintCallable, Category = "Refinery")
	bool SetActiveRecipe(int32 RecipeIndex);

	UFUNCTION(BlueprintPure, Category = "Refinery")
	bool HasActiveRecipe() const { return AvailableRecipes.IsValidIndex(ActiveRecipeIndex); }

protected:
	virtual bool CanProduce() const override;
	virtual void ProduceCycle() override;
};
