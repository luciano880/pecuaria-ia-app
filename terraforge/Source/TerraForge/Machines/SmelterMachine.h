#pragma once

#include "CoreMinimal.h"
#include "Machines/MachineBase.h"
#include "SmelterMachine.generated.h"

/** Receita simples: N de entrada -> M de saída. */
USTRUCT(BlueprintType)
struct TERRAFORGE_API FSmeltRecipe
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TObjectPtr<UItemData> InputItem = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 1))
	int32 InputCount = 1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TObjectPtr<UItemData> OutputItem = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 1))
	int32 OutputCount = 1;
};

/**
 * Fundição: consome minério do InputBuffer e produz lingotes no OutputBuffer
 * conforme a receita ativa.
 */
UCLASS()
class TERRAFORGE_API ASmelterMachine : public AMachineBase
{
	GENERATED_BODY()

public:
	ASmelterMachine();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Smelter")
	FSmeltRecipe ActiveRecipe;

protected:
	virtual bool CanProduce() const override;
	virtual void ProduceCycle() override;
};
