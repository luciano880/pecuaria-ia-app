#include "Progression/ExodusHub.h"
#include "Progression/TierProgressionSubsystem.h"
#include "Components/StaticMeshComponent.h"
#include "TerraForge.h"

AExodusHub::AExodusHub()
{
	MachineName = NSLOCTEXT("TerraForge", "HubName", "Hub Êxodo");
	MachineTint = FLinearColor(0.85f, 0.7f, 0.15f); // dourado

	// O Hub processa entregas rápido; não consome energia.
	TierSpecs[0].CycleTime = 0.5f;
	TierSpecs[0].PowerConsumptionMW = 0.0f;

	// Visual: plataforma de entrega + terminal + plataforma de lançamento.
	Mesh->SetStaticMesh(nullptr);
	CreatePart("Platform", CubeMeshAsset, FVector(0, 0, 25), FVector(4.0f, 4.0f, 0.5f),
		FRotator::ZeroRotator, /*bAccent*/ false);
	CreatePart("Terminal", CubeMeshAsset, FVector(-140, -140, 130),
		FVector(0.9f, 0.9f, 1.6f));
	CreatePart("LaunchPad", CylinderMeshAsset, FVector(500, 0, 15),
		FVector(3.2f, 3.2f, 0.3f));

	// Foguete do Projeto Êxodo: cada tier concluído revela um estágio.
	const FLinearColor White(0.9f, 0.9f, 0.95f);
	AddShipPart("ShipEngines", CylinderMeshAsset, FVector(500, 0, 110),
		FVector(1.6f, 1.6f, 1.6f), FRotator::ZeroRotator, /*Stage*/ 1, /*bAccent*/ true);
	AddShipPart("ShipBodyLower", CylinderMeshAsset, FVector(500, 0, 330),
		FVector(1.25f, 1.25f, 2.8f), FRotator::ZeroRotator, 2, false);
	AddShipPart("ShipBodyUpper", CylinderMeshAsset, FVector(500, 0, 610),
		FVector(1.1f, 1.1f, 2.8f), FRotator::ZeroRotator, 3, false);
	AddShipPart("ShipNose", SphereMeshAsset, FVector(500, 0, 800),
		FVector(1.05f, 1.05f, 1.6f), FRotator::ZeroRotator, 4, false);
	for (int32 i = 0; i < 3; ++i)
	{
		const float Yaw = i * 120.0f;
		const FVector FinOffset =
			FRotator(0.0f, Yaw, 0.0f).RotateVector(FVector(105, 0, 0));
		AddShipPart(*FString::Printf(TEXT("ShipFin%d"), i), CubeMeshAsset,
			FVector(500, 0, 120) + FinOffset, FVector(0.9f, 0.12f, 1.8f),
			FRotator(0.0f, Yaw, 0.0f), 5, true);
	}
}

void AExodusHub::AddShipPart(FName PartName, UStaticMesh* PartMesh,
	const FVector& RelLocation, const FVector& RelScale, const FRotator& RelRotation,
	int32 Stage, bool bAccent)
{
	UStaticMeshComponent* Part =
		CreatePart(PartName, PartMesh, RelLocation, RelScale, RelRotation, bAccent);
	Part->SetVisibility(false);
	Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	ShipParts.Add(Part);
	ShipPartStage.Add(Stage);
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
		UpdateShipVisual(Progression->CurrentTier); // sincroniza visual ao carregar
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

void AExodusHub::UpdateShipVisual(int32 CurrentTier)
{
	for (int32 i = 0; i < ShipParts.Num(); ++i)
	{
		const bool bVisible = ShipPartStage.IsValidIndex(i)
			&& CurrentTier >= ShipPartStage[i];
		if (ShipParts[i])
		{
			ShipParts[i]->SetVisibility(bVisible);
			ShipParts[i]->SetCollisionEnabled(
				bVisible ? ECollisionEnabled::QueryOnly : ECollisionEnabled::NoCollision);
		}
	}
}

void AExodusHub::HandleTierAdvanced(int32 NewTier)
{
	UpdateShipVisual(NewTier);

	UE_LOG(LogTerraForge, Log, TEXT("Projeto Êxodo: módulo %d — progresso %.0f%%"),
		NewTier, GetShipProgress() * 100.0f);
}
