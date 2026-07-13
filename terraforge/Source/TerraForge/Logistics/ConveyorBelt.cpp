#include "Logistics/ConveyorBelt.h"
#include "Machines/MachineBase.h"
#include "Components/SplineComponent.h"

AConveyorBelt::AConveyorBelt()
{
	PrimaryActorTick.bCanEverTick = true;

	Spline = CreateDefaultSubobject<USplineComponent>(TEXT("Spline"));
	SetRootComponent(Spline);
}

void AConveyorBelt::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	TryPickupFromSource();
	MoveItems(DeltaSeconds);
	TryDeliverToTarget();
}

void AConveyorBelt::TryPickupFromSource()
{
	if (!SourceMachine || SourceMachine->OutputBuffer.Num() == 0)
	{
		return;
	}

	// Só pega se a entrada da esteira estiver livre (espaçamento mínimo).
	// Itens são mantidos ordenados: o último do array é o mais próximo da origem.
	if (ItemsInTransit.Num() > 0 && ItemsInTransit.Last().Distance < ItemSpacing)
	{
		return;
	}

	FItemStack& FirstStack = SourceMachine->OutputBuffer[0];
	if (!FirstStack.IsValid())
	{
		return;
	}

	FConveyorItem NewItem;
	NewItem.Item = FirstStack.Item;
	NewItem.Distance = 0.0f;

	SourceMachine->RemoveFromBuffer(SourceMachine->OutputBuffer, FirstStack.Item, 1);
	ItemsInTransit.Add(NewItem);
}

void AConveyorBelt::MoveItems(float DeltaSeconds)
{
	const float BeltLength = Spline->GetSplineLength();
	const float Step = BeltSpeed * DeltaSeconds;

	// Percorre do item mais avançado para o de trás, respeitando o espaçamento.
	for (int32 i = 0; i < ItemsInTransit.Num(); ++i)
	{
		float MaxDistance = BeltLength;
		if (i > 0)
		{
			MaxDistance = ItemsInTransit[i - 1].Distance - ItemSpacing;
		}
		ItemsInTransit[i].Distance =
			FMath::Min(ItemsInTransit[i].Distance + Step, FMath::Max(MaxDistance, 0.0f));
	}
}

void AConveyorBelt::TryDeliverToTarget()
{
	if (!TargetMachine || ItemsInTransit.Num() == 0)
	{
		return;
	}

	const float BeltLength = Spline->GetSplineLength();
	FConveyorItem& Front = ItemsInTransit[0];

	if (Front.Distance >= BeltLength)
	{
		const int32 Added =
			TargetMachine->AddToBuffer(TargetMachine->InputBuffer, Front.Item, 1);
		if (Added > 0)
		{
			ItemsInTransit.RemoveAt(0);
		}
		// Se o destino estiver cheio, o item espera no fim da esteira (backpressure).
	}
}
