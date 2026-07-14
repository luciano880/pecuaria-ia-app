#include "Building/BuildSystemComponent.h"
#include "Machines/MachineBase.h"
#include "Items/InventoryComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "Engine/World.h"
#include "TerraForge.h"

UBuildSystemComponent::UBuildSystemComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UBuildSystemComponent::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (!IsPlacing() || !PreviewMesh)
	{
		return;
	}

	FTransform Desired;
	const bool bHitGround = ComputePlacementTransform(Desired);

	PreviewMesh->SetWorldTransform(Desired);
	PreviewTransform = Desired;

	// Válido se achou chão e não há nada bloqueando o volume da máquina.
	bool bBlocked = false;
	if (bHitGround)
	{
		const FBoxSphereBounds Bounds = PreviewMesh->CalcBounds(Desired);
		FCollisionQueryParams Params;
		Params.AddIgnoredActor(GetOwner());
		bBlocked = GetWorld()->OverlapBlockingTestByChannel(
			Bounds.Origin + FVector(0, 0, 10.0f), // levemente acima para ignorar o chão
			Desired.GetRotation(),
			ECC_WorldDynamic,
			FCollisionShape::MakeBox(Bounds.BoxExtent * 0.9f),
			Params);
	}

	bPlacementValid = bHitGround && !bBlocked;
	UpdatePreviewMaterial();
}

bool UBuildSystemComponent::ComputePlacementTransform(FTransform& OutTransform) const
{
	const APawn* Pawn = Cast<APawn>(GetOwner());
	const APlayerController* PC = Pawn ? Cast<APlayerController>(Pawn->GetController()) : nullptr;
	if (!PC)
	{
		return false;
	}

	FVector ViewLocation;
	FRotator ViewRotation;
	PC->GetPlayerViewPoint(ViewLocation, ViewRotation);

	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.AddIgnoredActor(GetOwner());
	const FVector TraceEnd = ViewLocation + ViewRotation.Vector() * BuildRange;
	const bool bHit =
		GetWorld()->LineTraceSingleByChannel(Hit, ViewLocation, TraceEnd, ECC_Visibility, Params);

	FVector Location = bHit ? Hit.Location : TraceEnd;
	Location.X = FMath::GridSnap(Location.X, GridSize);
	Location.Y = FMath::GridSnap(Location.Y, GridSize);

	OutTransform = FTransform(FRotator(0.0f, PreviewYaw, 0.0f), Location);
	return bHit;
}

void UBuildSystemComponent::StartPlacement(TSubclassOf<AMachineBase> MachineClass)
{
	if (!MachineClass)
	{
		return;
	}

	CancelPlacement();
	PendingClass = MachineClass;
	PreviewYaw = 0.0f;

	// O preview usa a malha do CDO da máquina — nada é spawnado de verdade
	// (evita efeitos colaterais de BeginPlay, como registrar na rede elétrica).
	const AMachineBase* CDO = MachineClass->GetDefaultObject<AMachineBase>();
	UStaticMesh* SourceMesh =
		CDO && CDO->GetMachineMesh() ? CDO->GetMachineMesh()->GetStaticMesh() : nullptr;

	PreviewMesh = NewObject<UStaticMeshComponent>(GetOwner());
	PreviewMesh->SetStaticMesh(SourceMesh);
	PreviewMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	PreviewMesh->RegisterComponent();
	UpdatePreviewMaterial();
}

void UBuildSystemComponent::CancelPlacement()
{
	PendingClass = nullptr;
	bPlacementValid = false;
	DestroyPreview();
}

bool UBuildSystemComponent::ConfirmPlacement(UInventoryComponent* Payer)
{
	if (!IsPlacing() || !bPlacementValid)
	{
		return false;
	}

	const AMachineBase* CDO = PendingClass->GetDefaultObject<AMachineBase>();
	if (Payer && CDO && !Payer->ConsumeItems(CDO->BuildCost))
	{
		UE_LOG(LogTerraForge, Log, TEXT("Construção negada: itens insuficientes para %s"),
			*PendingClass->GetName());
		return false;
	}

	FActorSpawnParameters SpawnParams;
	SpawnParams.SpawnCollisionHandlingOverride =
		ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
	AMachineBase* NewMachine =
		GetWorld()->SpawnActor<AMachineBase>(PendingClass, PreviewTransform, SpawnParams);

	if (NewMachine)
	{
		OnMachinePlaced.Broadcast(NewMachine);
	}

	// Mantém o modo de construção ativo para encadear várias máquinas.
	return NewMachine != nullptr;
}

void UBuildSystemComponent::RotatePreview(float DegreeStep)
{
	PreviewYaw = FMath::Fmod(PreviewYaw + DegreeStep, 360.0f);
}

void UBuildSystemComponent::UpdatePreviewMaterial()
{
	if (!PreviewMesh)
	{
		return;
	}

	UMaterialInterface* Material = bPlacementValid ? ValidPreviewMaterial : InvalidPreviewMaterial;
	if (Material)
	{
		for (int32 i = 0; i < PreviewMesh->GetNumMaterials(); ++i)
		{
			PreviewMesh->SetMaterial(i, Material);
		}
	}
}

void UBuildSystemComponent::DestroyPreview()
{
	if (PreviewMesh)
	{
		PreviewMesh->DestroyComponent();
		PreviewMesh = nullptr;
	}
}
