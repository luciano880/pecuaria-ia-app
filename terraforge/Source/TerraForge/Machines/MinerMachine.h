#pragma once

#include "CoreMinimal.h"
#include "Machines/MachineBase.h"
#include "MinerMachine.generated.h"

class AResourceNode;

/**
 * Mineradora: posicionada sobre uma AResourceNode, extrai minério a cada ciclo
 * e coloca no OutputBuffer (de onde esteiras puxam).
 */
UCLASS()
class TERRAFORGE_API AMinerMachine : public AMachineBase
{
	GENERATED_BODY()

public:
	AMinerMachine();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Jazida sob a mineradora. Se nulo, é detectada por overlap no BeginPlay. */
	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "Miner")
	TObjectPtr<AResourceNode> TargetNode;

	/** Raio de busca da jazida quando TargetNode não foi definido à mão. */
	UPROPERTY(EditDefaultsOnly, Category = "Miner", meta = (ClampMin = 0))
	float NodeSearchRadius = 400.0f;

protected:
	virtual bool CanProduce() const override;
	virtual void ProduceCycle() override;

private:
	void FindTargetNode();

	/** Broca que gira quando a máquina está produzindo. */
	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Drill;
};
