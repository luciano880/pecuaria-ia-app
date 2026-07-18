#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "BuildSystemComponent.generated.h"

class AMachineBase;
class UInventoryComponent;
class UStaticMeshComponent;
class UMaterialInterface;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnMachinePlaced, AMachineBase*, NewMachine);

/**
 * Modo de construção do jogador:
 *  1. StartPlacement(classe) — mostra um "fantasma" da máquina na mira;
 *  2. o fantasma segue o olhar com snap em grade e fica verde/vermelho;
 *  3. ConfirmPlacement — cobra o BuildCost do inventário e constrói de verdade.
 * O modo continua ativo após construir (encadear várias máquinas), até CancelPlacement.
 */
UCLASS(ClassGroup = (TerraForge), meta = (BlueprintSpawnableComponent))
class TERRAFORGE_API UBuildSystemComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UBuildSystemComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

	/** Tamanho da célula do snap, em uu (100 = 1 m). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Build", meta = (ClampMin = 1))
	float GridSize = 100.0f;

	/** Alcance máximo de construção a partir da câmera. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Build", meta = (ClampMin = 100))
	float BuildRange = 3000.0f;

	/** Material translúcido do preview quando o local é válido (verde). */
	UPROPERTY(EditDefaultsOnly, Category = "Build")
	TObjectPtr<UMaterialInterface> ValidPreviewMaterial;

	/** Material translúcido do preview quando o local é inválido (vermelho). */
	UPROPERTY(EditDefaultsOnly, Category = "Build")
	TObjectPtr<UMaterialInterface> InvalidPreviewMaterial;

	UFUNCTION(BlueprintCallable, Category = "Build")
	void StartPlacement(TSubclassOf<AMachineBase> MachineClass);

	UFUNCTION(BlueprintCallable, Category = "Build")
	void CancelPlacement();

	/** Constrói no local atual do preview. @return true se construiu. */
	UFUNCTION(BlueprintCallable, Category = "Build")
	bool ConfirmPlacement(UInventoryComponent* Payer);

	/** Gira o preview em incrementos (padrão 90°). */
	UFUNCTION(BlueprintCallable, Category = "Build")
	void RotatePreview(float DegreeStep = 90.0f);

	UFUNCTION(BlueprintPure, Category = "Build")
	bool IsPlacing() const { return PendingClass != nullptr; }

	UFUNCTION(BlueprintPure, Category = "Build")
	bool IsPlacementValid() const { return bPlacementValid; }

	/** Nome amigável da máquina sendo construída (para o HUD). */
	UFUNCTION(BlueprintPure, Category = "Build")
	FString GetPendingMachineName() const;

	UPROPERTY(BlueprintAssignable, Category = "Build")
	FOnMachinePlaced OnMachinePlaced;

private:
	UPROPERTY()
	TSubclassOf<AMachineBase> PendingClass;

	/** Raiz do fantasma; as cópias das peças da máquina ficam penduradas nela. */
	UPROPERTY()
	TObjectPtr<USceneComponent> PreviewRoot;

	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> PreviewMeshes;

	bool bPlacementValid = false;
	float PreviewYaw = 0.0f;
	FTransform PreviewTransform;

	/** Traça da câmera até o chão e calcula o transform com snap. @return achou chão? */
	bool ComputePlacementTransform(FTransform& OutTransform) const;

	void UpdatePreviewMaterial();
	void DestroyPreview();
};
