#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ResourceNode.generated.h"

class UItemData;

UENUM(BlueprintType)
enum class ENodePurity : uint8
{
	Impure  UMETA(DisplayName = "Impura (x0.5)"),
	Normal  UMETA(DisplayName = "Normal (x1.0)"),
	Pure    UMETA(DisplayName = "Pura (x2.0)")
};

/**
 * Jazida de recurso no mundo. Mineradoras se posicionam sobre ela e chamam Extract().
 */
UCLASS()
class TERRAFORGE_API AResourceNode : public AActor
{
	GENERATED_BODY()

public:
	AResourceNode();

	/** Tipo de minério desta jazida. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	TObjectPtr<UItemData> OreType;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	ENodePurity Purity = ENodePurity::Normal;

	/** Quantidade restante. -1 = infinita (padrão estilo Satisfactory). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	int32 RemainingAmount = -1;

	/** Multiplicador de extração dado pela pureza. */
	UFUNCTION(BlueprintPure, Category = "Resource")
	float GetPurityMultiplier() const;

	/**
	 * Tenta extrair até DesiredAmount unidades.
	 * @return quantidade realmente extraída (limitada pelo que resta na jazida).
	 */
	UFUNCTION(BlueprintCallable, Category = "Resource")
	int32 Extract(int32 DesiredAmount);

	UFUNCTION(BlueprintPure, Category = "Resource")
	bool IsDepleted() const { return RemainingAmount == 0; }

protected:
	UPROPERTY(VisibleAnywhere, Category = "Resource")
	TObjectPtr<UStaticMeshComponent> Mesh;
};
