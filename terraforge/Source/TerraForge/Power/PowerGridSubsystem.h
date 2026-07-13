#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "PowerGridSubsystem.generated.h"

class AMachineBase;

/**
 * Rede elétrica global (MVP: um único grid para o mundo todo).
 *
 * Produção < consumo => brownout: todas as máquinas recebem
 * GridEfficiency = produção/consumo e produzem proporcionalmente mais devagar.
 *
 * Evolução futura: múltiplos grids por componente conexo de postes/cabos.
 */
UCLASS()
class TERRAFORGE_API UPowerGridSubsystem : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override
	{
		RETURN_QUICK_DECLARE_CYCLE_STAT(UPowerGridSubsystem, STATGROUP_Tickables);
	}

	void RegisterConsumer(AMachineBase* Machine);
	void UnregisterConsumer(AMachineBase* Machine);

	/** Capacidade de geração total em MW (geradores somam aqui). */
	UFUNCTION(BlueprintCallable, Category = "Power")
	void AddProductionMW(float DeltaMW) { TotalProductionMW = FMath::Max(0.0f, TotalProductionMW + DeltaMW); }

	UFUNCTION(BlueprintPure, Category = "Power")
	float GetTotalProductionMW() const { return TotalProductionMW; }

	UFUNCTION(BlueprintPure, Category = "Power")
	float GetTotalDemandMW() const { return CachedDemandMW; }

	UFUNCTION(BlueprintPure, Category = "Power")
	float GetGridEfficiency() const { return CachedEfficiency; }

private:
	UPROPERTY()
	TArray<TWeakObjectPtr<AMachineBase>> Consumers;

	float TotalProductionMW = 0.0f;
	float CachedDemandMW = 0.0f;
	float CachedEfficiency = 1.0f;
};
