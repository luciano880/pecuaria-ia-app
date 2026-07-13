#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Items/ItemData.h"
#include "TierProgressionSubsystem.generated.h"

/** Meta de entrega de um item para completar um tier. */
USTRUCT(BlueprintType)
struct TERRAFORGE_API FTierGoal
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TObjectPtr<UItemData> Item = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 1))
	int32 Required = 1;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
	int32 Delivered = 0;

	bool IsComplete() const { return Delivered >= Required; }
};

/** Definição de um tier tecnológico. */
USTRUCT(BlueprintType)
struct TERRAFORGE_API FTierDefinition
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	FText TierName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TArray<FTierGoal> Goals;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTierAdvanced, int32, NewTier);

/**
 * Progressão de fases tecnológicas do jogo (Tier 0 → 5).
 * O Hub entrega itens aqui via DeliverItem(); quando todas as metas do tier
 * atual são cumpridas, AdvanceTier() libera a próxima fase.
 */
UCLASS()
class TERRAFORGE_API UTierProgressionSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	/** Tiers do jogo; configurar via Blueprint do Hub ou DataAsset no boot. */
	UPROPERTY(BlueprintReadWrite, Category = "Progression")
	TArray<FTierDefinition> Tiers;

	UPROPERTY(BlueprintReadOnly, Category = "Progression")
	int32 CurrentTier = 0;

	/**
	 * Entrega itens para as metas do tier atual.
	 * @return quantidade aceita (0 se o item não é meta ou já está completo).
	 */
	UFUNCTION(BlueprintCallable, Category = "Progression")
	int32 DeliverItem(UItemData* Item, int32 Count);

	UFUNCTION(BlueprintPure, Category = "Progression")
	bool IsCurrentTierComplete() const;

	/** Avança para o próximo tier se as metas atuais estiverem completas. */
	UFUNCTION(BlueprintCallable, Category = "Progression")
	bool AdvanceTier();

	UPROPERTY(BlueprintAssignable, Category = "Progression")
	FOnTierAdvanced OnTierAdvanced;
};
