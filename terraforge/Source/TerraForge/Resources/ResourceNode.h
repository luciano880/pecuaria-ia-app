#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ResourceNode.generated.h"

class UItemData;
class UStaticMeshComponent;

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

	virtual void BeginPlay() override;

	/** Cor do placeholder (ferro = ferrugem, carvão = escuro, gêiser = ciano...). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	FLinearColor NodeTint = FLinearColor(0.55f, 0.3f, 0.2f);

	/** Tipo de minério desta jazida. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	TObjectPtr<UItemData> OreType;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	ENodePurity Purity = ENodePurity::Normal;

	/** Quantidade restante. -1 = infinita (padrão estilo Satisfactory). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	int32 RemainingAmount = -1;

	/**
	 * true para gêiseres: não têm OreType nem extração — servem de fundação
	 * obrigatória para a usina geotérmica (ARenewableGenerator::Geothermal).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Resource")
	bool bIsGeyser = false;

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

	/** Pedaços de minério sobre o monte principal. */
	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> Chunks;

	/** Coluna de vapor, visível apenas em gêiseres. */
	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Steam;

private:
	/** Cor automática pelo tipo de minério quando NodeTint não foi alterada. */
	FLinearColor ResolveTint() const;
};
