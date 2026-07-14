#include "Machines/GeneratorMachine.h"
#include "Power/PowerGridSubsystem.h"
#include "Environment/EnvironmentSubsystem.h"

AGeneratorMachine::AGeneratorMachine()
{
	MachineName = NSLOCTEXT("TerraForge", "GeneratorName", "Gerador");
}

void AGeneratorMachine::Tick(float DeltaSeconds)
{
	// Pula o ciclo de produção de AMachineBase: gerador produz MW, não itens.
	AActor::Tick(DeltaSeconds);

	if (FuelRemainingSeconds <= 0.0f && FuelItem)
	{
		if (RemoveFromBuffer(InputBuffer, FuelItem, 1) == 1)
		{
			FuelRemainingSeconds = SecondsPerFuelUnit;

			if (WasteOutput.IsValid())
			{
				AddToBuffer(OutputBuffer, WasteOutput.Item, WasteOutput.Count);
			}
		}
	}

	const bool bHasFuel = FuelRemainingSeconds > 0.0f;
	if (bHasFuel)
	{
		FuelRemainingSeconds -= DeltaSeconds;

		// Usinas a combustível poluem enquanto queimam (valor no TierSpec).
		if (EnvSubsystem)
		{
			EnvSubsystem->AddPollution(
				GetCurrentSpec().PollutionPerMinute * DeltaSeconds / 60.0f);
		}
	}
	SetOnline(bHasFuel);
}

void AGeneratorMachine::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	SetOnline(false);
	Super::EndPlay(EndPlayReason);
}

void AGeneratorMachine::SetOnline(bool bNewOnline)
{
	if (bNewOnline == bOnline)
	{
		return;
	}
	bOnline = bNewOnline;

	if (UWorld* World = GetWorld())
	{
		if (UPowerGridSubsystem* Grid = World->GetSubsystem<UPowerGridSubsystem>())
		{
			Grid->AddProductionMW(bOnline ? PowerOutputMW : -PowerOutputMW);
		}
	}
}
