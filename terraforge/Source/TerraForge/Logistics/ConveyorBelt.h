#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Items/ItemData.h"
#include "ConveyorBelt.generated.h"

class AMachineBase;
class USplineComponent;

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

protected:
	UPROPERTY(VisibleAnywhere, Category = "Conveyor")
	TObjectPtr<USplineComponent> Spline;

	UPROPERTY()
	TArray<FConveyorItem> ItemsInTransit;

private:
	void TryPickupFromSource();
	void MoveItems(float DeltaSeconds);
	void TryDeliverToTarget();
};
