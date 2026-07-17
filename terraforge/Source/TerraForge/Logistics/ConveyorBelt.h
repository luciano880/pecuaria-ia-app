#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Items/ItemData.h"
#include "ConveyorBelt.generated.h"

class AMachineBase;
class USplineComponent;
class USplineMeshComponent;
class UInstancedStaticMeshComponent;

/** Item em trânsito na esteira. */
USTRUCT()
struct FConveyorItem
{
	GENERATED_BODY()

	UPROPERTY()
	TObjectPtr<UItemData> Item = nullptr;

	/** Distância percorrida ao longo do spline, em uu. */
	float Distance = 0.0f;
};

/**
 * Esteira transportadora: puxa 1 item por vez do OutputBuffer da máquina de origem,
 * move ao longo do spline e entrega no InputBuffer da máquina de destino.
 */
UCLASS()
class TERRAFORGE_API AConveyorBelt : public AActor
{
	GENERATED_BODY()

public:
	AConveyorBelt();

	virtual void Tick(float DeltaSeconds) override;

	UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Category = "Conveyor")
	TObjectPtr<AMachineBase> SourceMachine;

	UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Category = "Conveyor")
	TObjectPtr<AMachineBase> TargetMachine;

	/** Velocidade da esteira em uu/s (Mk1 ~ 120, Mk2 ~ 240...). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Conveyor", meta = (ClampMin = 1))
	float BeltSpeed = 120.0f;

	/** Espaçamento mínimo entre itens na esteira, em uu. */
	UPROPERTY(EditAnywhere, Category = "Conveyor", meta = (ClampMin = 10))
	float ItemSpacing = 100.0f;

	UFUNCTION(BlueprintPure, Category = "Conveyor")
	int32 GetItemsInTransit() const { return ItemsInTransit.Num(); }

	/**
	 * Configura a esteira como uma linha reta entre duas máquinas e
	 * reconstrói o visual. Usada pelo spawn por código (fábrica demo).
	 */
	UFUNCTION(BlueprintCallable, Category = "Conveyor")
	void InitializeStraightBelt(AMachineBase* Source, AMachineBase* Target);

	/** Recria os segmentos visuais da esteira a partir do spline atual. */
	UFUNCTION(BlueprintCallable, Category = "Conveyor")
	void RebuildVisuals();

	UFUNCTION(BlueprintPure, Category = "Conveyor")
	USplineComponent* GetSpline() const { return Spline; }

protected:
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, Category = "Conveyor")
	TObjectPtr<USplineComponent> Spline;

	/** Instâncias que mostram os itens viajando na esteira. */
	UPROPERTY(VisibleAnywhere, Category = "Conveyor")
	TObjectPtr<UInstancedStaticMeshComponent> ItemsVisual;

	/** Malha usada nos segmentos da esteira (cubo do engine por padrão). */
	UPROPERTY(EditDefaultsOnly, Category = "Conveyor")
	TObjectPtr<UStaticMesh> SegmentMesh;

	UPROPERTY()
	TArray<FConveyorItem> ItemsInTransit;

	UPROPERTY()
	TArray<TObjectPtr<USplineMeshComponent>> SegmentMeshes;

private:
	void TryPickupFromSource();
	void MoveItems(float DeltaSeconds);
	void TryDeliverToTarget();
	void UpdateItemsVisual();
};
