#include "Progression/ExodusHub.h"
#include "Progression/TierProgressionSubsystem.h"
#include "Components/StaticMeshComponent.h"
#include "TerraForge.h"

AExodusHub::AExodusHub()
{
	MachineName = NSLOCTEXT("TerraForge", "HubName", "Hub Êxodo");

	// O Hub processa entregas rápido; não consome energia.
	TierSpecs[0].CycleTime = 0.5f;
	TierSpecs[0].PowerConsumptionMW = 0.0f;

	ShipMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ShipMesh"));
	ShipMesh->SetupAttachment(RootComponent);
	ShipMesh->SetRelativeLocation(FVector(2000.0f, 0.0f, 0.0f)); // plataforma ao lado
}

void AExodusHub::BeginPlay()
{
	Super::BeginPlay();

	if (const UGameInstance* GameInstance = GetGameInstance())
	{
		Progression = GameInstance->GetSubsystem<UTierProgressionSubsystem>();
	}

	if (Progression)
	{
		Progression->OnTierAdvanced.AddDynamic(this, &AExodusHub::HandleTierAdvanced);
		HandleTierAdvanced(Progression->CurrentTier); // sincroniza visual ao carregar
	}
}

int32 AExodusHub::DepositItem(UItemData* Item, int32 Count)
{
	return AddToBuffer(InputBuffer, Item, Count);
}

float AExodusHub::GetShipProgress() const
{
	if (!Progression || Progression->Tiers.Num() == 0)
	{
		return 0.0f;
	}
	return static_cast<float>(Progression->CurrentTier) / Progression->Tiers.Num();
}

bool AExodusHub::CanProduce() const
{
	return Progression != nullptr && InputBuffer.Num() > 0;
}

void AExodusHub::ProduceCycle()
{
	// Tenta entregar a primeira pilha do buffer às metas do tier atual.
	FItemStack Stack = InputBuffer[0];
	const int32 Accepted = Progression->DeliverItem(Stack.Item, Stack.Count);

	if (Accepted > 0)
	{
		RemoveFromBuffer(InputBuffer, Stack.Item, Accepted);
	}
	else if (InputBuffer.Num() > 1)
	{
		// Item não é meta agora: rotaciona a pilha para o fim da fila,
		// dando vez às demais (só há uma pilha por tipo de item no buffer).
		InputBuffer.RemoveAt(0);
		InputBuffer.Add(Stack);
	}

	if (bAutoAdvanceTier && Progression->IsCurrentTierComplete())
	{
		Progression->AdvanceTier();
	}
}

void AExodusHub::HandleTierAdvanced(int32 NewTier)
{
	// Tier N concluído => estágio N-1 da nave visível.
	const int32 StageIndex = NewTier - 1;
	if (ShipStageMeshes.IsValidIndex(StageIndex))
	{
		if (UStaticMesh* StageMesh = ShipStageMeshes[StageIndex].LoadSynchronous())
		{
			ShipMesh->SetStaticMesh(StageMesh);
		}
	}

	UE_LOG(LogTerraForge, Log, TEXT("Projeto Êxodo: módulo %d — progresso %.0f%%"),
		NewTier, GetShipProgress() * 100.0f);
}
