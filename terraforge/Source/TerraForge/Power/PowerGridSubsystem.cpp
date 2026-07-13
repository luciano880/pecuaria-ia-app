#include "Power/PowerGridSubsystem.h"
#include "Machines/MachineBase.h"

void UPowerGridSubsystem::RegisterConsumer(AMachineBase* Machine)
{
	if (Machine)
	{
		Consumers.AddUnique(Machine);
	}
}

void UPowerGridSubsystem::UnregisterConsumer(AMachineBase* Machine)
{
	Consumers.Remove(Machine);
}

void UPowerGridSubsystem::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	// Soma a demanda de todas as máquinas vivas.
	CachedDemandMW = 0.0f;
	for (int32 i = Consumers.Num() - 1; i >= 0; --i)
	{
		if (const AMachineBase* Machine = Consumers[i].Get())
		{
			CachedDemandMW += Machine->GetPowerDemandMW();
		}
		else
		{
			Consumers.RemoveAt(i);
		}
	}

	// Brownout proporcional quando falta energia.
	CachedEfficiency = (CachedDemandMW <= TotalProductionMW || CachedDemandMW <= 0.0f)
		? 1.0f
		: TotalProductionMW / CachedDemandMW;

	for (const TWeakObjectPtr<AMachineBase>& WeakMachine : Consumers)
	{
		if (AMachineBase* Machine = WeakMachine.Get())
		{
			// Máquinas sem consumo elétrico (manuais/a combustível) ignoram o grid.
			Machine->GridEfficiency =
				(Machine->GetPowerDemandMW() > 0.0f) ? CachedEfficiency : 1.0f;
		}
	}
}
