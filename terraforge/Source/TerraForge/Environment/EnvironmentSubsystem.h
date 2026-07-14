#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "EnvironmentSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnEnvironmentalIndexChanged, float, NewIndex);

/**
 * Saúde ambiental do planeta — o coração narrativo do jogo (ver docs/HISTORIA.md).
 *
 * Máquinas e usinas despejam poluição aqui; a natureza dissipa uma parte por
 * minuto. O índice [0..100] cai conforme a poluição acumula:
 *  - índice < 50: máquinas perdem eficiência (o planeta cobra o preço);
 *  - índice ≥ 80 sustentado: condição do Final B (Regeneração).
 */
UCLASS()
class TERRAFORGE_API UEnvironmentSubsystem : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override
	{
		RETURN_QUICK_DECLARE_CYCLE_STAT(UEnvironmentSubsystem, STATGROUP_Tickables);
	}

	/** Chamado pelas máquinas a cada tick de operação. */
	void AddPollution(float Amount) { AccumulatedPollution += FMath::Max(0.0f, Amount); }

	/** Ações de recuperação (reflorestamento, filtros) removem poluição acumulada. */
	UFUNCTION(BlueprintCallable, Category = "Environment")
	void RemovePollution(float Amount)
	{
		AccumulatedPollution = FMath::Max(0.0f, AccumulatedPollution - Amount);
	}

	UFUNCTION(BlueprintPure, Category = "Environment")
	float GetEnvironmentalIndex() const { return EnvironmentalIndex; }

	UFUNCTION(BlueprintPure, Category = "Environment")
	float GetAccumulatedPollution() const { return AccumulatedPollution; }

	/** Multiplicador de eficiência aplicado a TODAS as máquinas (penalidade por poluição). */
	UFUNCTION(BlueprintPure, Category = "Environment")
	float GetMachineEfficiencyMultiplier() const;

	UPROPERTY(BlueprintAssignable, Category = "Environment")
	FOnEnvironmentalIndexChanged OnEnvironmentalIndexChanged;

	// --- Balanceamento ---

	/** Poluição dissipada naturalmente por minuto. */
	UPROPERTY(EditAnywhere, Category = "Environment", meta = (ClampMin = 0))
	float NaturalRecoveryPerMinute = 10.0f;

	/** Poluição acumulada que zera o índice (escala da barra). */
	UPROPERTY(EditAnywhere, Category = "Environment", meta = (ClampMin = 1))
	float PollutionForZeroIndex = 10000.0f;

private:
	float AccumulatedPollution = 0.0f;
	float EnvironmentalIndex = 100.0f;
	float LastBroadcastIndex = 100.0f;
};
