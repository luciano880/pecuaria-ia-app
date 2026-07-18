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

	if (!IsPlacing() || !PreviewRoot)
	{
		return;
	}

	FTransform Desired;
	const bool bHitGround = ComputePlacementTransform(Desired);

	PreviewRoot->SetWorldTransform(Desired);
	PreviewTransform = Desired;

	// Válido se achou chão e não há nada bloqueando o volume da máquina.
	bool bBlocked = false;
	if (bHitGround)
	{
		FBox CombinedBox(EForceInit::ForceInit);
		for (const UStaticMeshComponent* Preview : PreviewMeshes)
		{
			if (Preview)
			{
				CombinedBox += Preview->Bounds.GetBox();
			}
		}

		if (CombinedBox.IsValid)
		{
			FCollisionQueryParams Params;
			Params.AddIgnoredActor(GetOwner());
			bBlocked = GetWorld()->OverlapBlockingTestByChannel(
				CombinedBox.GetCenter() + FVector(0, 0, 10.0f), // ignora o chão
				FQuat::Identity,
				ECC_WorldDynamic,
				FCollisionShape::MakeBox(CombinedBox.GetExtent() * 0.9f),
				Params);
		}
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

	// O fantasma replica as peças visuais do CDO da máquina — nada é spawnado
	// de verdade (evita efeitos colaterais de BeginPlay, como registrar na rede).
	const AMachineBase* CDO = MachineClass->GetDefaultObject<AMachineBase>();

	PreviewRoot = NewObject<USceneComponent>(GetOwner());
	PreviewRoot->RegisterComponent();

	TInlineComponentArray<UStaticMeshComponent*> CDOParts(CDO);
	for (const UStaticMeshComponent* Part : CDOParts)
	{
		if (!Part || !Part->GetStaticMesh() || !Part->IsVisible())
		{
			continue;
		}

		// Transform da peça relativo ao root do CDO (acumula a cadeia de attach).
		FTransform RelativeToActor = Part->GetRelativeTransform();
		for (const USceneComponent* Parent = Part->GetAttachParent();
			Parent; Parent = Parent->GetAttachParent())
		{
			RelativeToActor *= Parent->GetRelativeTransform();
		}

		UStaticMeshComponent* Preview = NewObject<UStaticMeshComponent>(GetOwner());
		Preview->SetStaticMesh(Part->GetStaticMesh());
		Preview->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Preview->AttachToComponent(PreviewRoot,
			FAttachmentTransformRules::KeepRelativeTransform);
		Preview->SetRelativeTransform(RelativeToActor);
		Preview->RegisterComponent();
		PreviewMeshes.Add(Preview);
	}

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

FString UBuildSystemComponent::GetPendingMachineName() const
{
	if (!PendingClass)
	{
		return FString();
	}
	const AMachineBase* CDO = PendingClass->GetDefaultObject<AMachineBase>();
	return CDO ? CDO->MachineName.ToString() : PendingClass->GetName();
}

void UBuildSystemComponent::RotatePreview(float DegreeStep)
{
	PreviewYaw = FMath::Fmod(PreviewYaw + DegreeStep, 360.0f);
}

void UBuildSystemComponent::UpdatePreviewMaterial()
{
	UMaterialInterface* Material = bPlacementValid ? ValidPreviewMaterial : InvalidPreviewMaterial;
	if (!Material)
	{
		return;
	}

	for (UStaticMeshComponent* Preview : PreviewMeshes)
	{
		if (Preview)
		{
			for (int32 i = 0; i < Preview->GetNumMaterials(); ++i)
			{
				Preview->SetMaterial(i, Material);
			}
		}
	}
}

void UBuildSystemComponent::DestroyPreview()
{
	for (UStaticMeshComponent* Preview : PreviewMeshes)
	{
		if (Preview)
		{
			Preview->DestroyComponent();
		}
	}
	PreviewMeshes.Reset();

	if (PreviewRoot)
	{
		PreviewRoot->DestroyComponent();
		PreviewRoot = nullptr;
	}
}
