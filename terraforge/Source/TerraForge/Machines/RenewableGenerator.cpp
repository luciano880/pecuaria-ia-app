#include "Machines/RenewableGenerator.h"
#include "Power/PowerGridSubsystem.h"

ARenewableGenerator::ARenewableGenerator()
{
	MachineName = NSLOCTEXT("TerraForge", "RenewableName", "Gerador Renovável");
}

void ARenewableGenerator::Tick(float DeltaSeconds)
{
	// Pula o ciclo de produção de AMachineBase: gerador produz MW, não itens.
	AActor::Tick(DeltaSeconds);

	const float Factor = ComputeCapacityFactor(GetWorld()->GetTimeSeconds());
	SetGridOutput(PeakOutputMW * Factor);
}

void ARenewableGenerator::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	SetGridOutput(0.0f);
	Super::EndPlay(EndPlayReason);
}

float ARenewableGenerator::ComputeCapacityFactor(float WorldTimeSeconds) const
{
	switch (SourceType)
	{
	case ERenewableType::Geothermal:
		// Gêiser entrega potência constante, dia e noite.
		return 1.0f;

	case ERenewableType::Solar:
	{
		// Meio ciclo com sol (senoide), meio ciclo de noite (zero).
		const float DayPhase =
			FMath::Fmod(WorldTimeSeconds, DayLengthSeconds) / DayLengthSeconds; // [0..1)
		return FMath::Max(0.0f, FMath::Sin(DayPhase * 2.0f * PI));
	}

	case ERenewableType::Wind:
	{
		// Ruído suave e determinístico; offset por ator para turbinas não sincronizarem.
		const float Seed = GetUniqueID() * 17.0f;
		const float Noise = FMath::PerlinNoise1D(Seed + WorldTimeSeconds * WindVariability);
		const float Normalized = 0.5f + 0.5f * Noise; // [0..1]
		return FMath::Lerp(MinWindFactor, 1.0f, Normalized);
	}

	default:
		return 0.0f;
	}
}

void ARenewableGenerator::SetGridOutput(float NewOutputMW)
{
	if (FMath::IsNearlyEqual(NewOutputMW, CurrentOutputMW))
	{
		return;
	}

	if (UWorld* World = GetWorld())
	{
		if (UPowerGridSubsystem* Grid = World->GetSubsystem<UPowerGridSubsystem>())
		{
			Grid->AddProductionMW(NewOutputMW - CurrentOutputMW);
			CurrentOutputMW = NewOutputMW;
		}
	}
}
