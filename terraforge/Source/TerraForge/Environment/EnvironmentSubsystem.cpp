#include "Environment/EnvironmentSubsystem.h"

void UEnvironmentSubsystem::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	// A natureza dissipa parte da poluição com o tempo.
	AccumulatedPollution =
		FMath::Max(0.0f, AccumulatedPollution - NaturalRecoveryPerMinute * DeltaTime / 60.0f);

	EnvironmentalIndex =
		FMath::Clamp(100.0f * (1.0f - AccumulatedPollution / PollutionForZeroIndex), 0.0f, 100.0f);

	// Notifica UI apenas em mudanças perceptíveis.
	if (!FMath::IsNearlyEqual(EnvironmentalIndex, LastBroadcastIndex, 0.5f))
	{
		LastBroadcastIndex = EnvironmentalIndex;
		OnEnvironmentalIndexChanged.Broadcast(EnvironmentalIndex);
	}
}

float UEnvironmentSubsystem::GetMachineEfficiencyMultiplier() const
{
	// Acima de 50 não há penalidade; abaixo, cai linearmente até 50% em índice 0.
	if (EnvironmentalIndex >= 50.0f)
	{
		return 1.0f;
	}
	return 0.5f + 0.5f * (EnvironmentalIndex / 50.0f);
}
