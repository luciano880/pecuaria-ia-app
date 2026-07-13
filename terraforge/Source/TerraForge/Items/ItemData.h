#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "ItemData.generated.h"

/**
 * Definição de um item/recurso do jogo (minério, lingote, peça...).
 * Criar um Data Asset por item no editor (ex.: DA_IronOre, DA_IronIngot).
 */
UCLASS(BlueprintType)
class TERRAFORGE_API UItemData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	FText DisplayName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	TSoftObjectPtr<UTexture2D> Icon;

	/** Malha usada quando o item viaja em esteiras. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	TSoftObjectPtr<UStaticMesh> BeltMesh;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item", meta = (ClampMin = 1))
	int32 MaxStackSize = 100;

	/** true para minérios brutos extraídos de jazidas. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	bool bIsRawOre = false;
};

/** Uma pilha de itens (item + quantidade). */
USTRUCT(BlueprintType)
struct TERRAFORGE_API FItemStack
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Item")
	TObjectPtr<UItemData> Item = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Item", meta = (ClampMin = 0))
	int32 Count = 0;

	bool IsValid() const { return Item != nullptr && Count > 0; }
};
