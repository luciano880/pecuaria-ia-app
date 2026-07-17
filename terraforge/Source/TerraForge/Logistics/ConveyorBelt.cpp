#include "Logistics/ConveyorBelt.h"
#include "Machines/MachineBase.h"
#include "Components/SplineComponent.h"
#include "Components/SplineMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

AConveyorBelt::AConveyorBelt()
{
	PrimaryActorTick.bCanEverTick = true;

	Spline = CreateDefaultSubobject<USplineComponent>(TEXT("Spline"));
	SetRootComponent(Spline);

	ItemsVisual = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("ItemsVisual"));
	ItemsVisual->SetupAttachment(Spline);
	ItemsVisual->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(
		TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (CubeMesh.Succeeded())
	{
		SegmentMesh = CubeMesh.Object;
	}
	if (SphereMesh.Succeeded())
	{
		ItemsVisual->SetStaticMesh(SphereMesh.Object);
	}
}

void AConveyorBelt::BeginPlay()
{
	Super::BeginPlay();
	RebuildVisuals();
}

void AConveyorBelt::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	TryPickupFromSource();
	MoveItems(DeltaSeconds);
	TryDeliverToTarget();
	UpdateItemsVisual();
}

void AConveyorBelt::InitializeStraightBelt(AMachineBase* Source, AMachineBase* Target)
{
	if (!Source || !Target)
	{
		return;
	}

	SourceMachine = Source;
	TargetMachine = Target;

	const float BeltHeight = 60.0f;
	FVector Start = Source->GetActorLocation() + FVector(0, 0, BeltHeight);
	FVector End = Target->GetActorLocation() + FVector(0, 0, BeltHeight);

	// Encurta as pontas para a esteira não atravessar as máquinas.
	const FVector Dir = (End - Start).GetSafeNormal();
	Start += Dir * 150.0f;
	End -= Dir * 150.0f;

	Spline->ClearSplinePoints(false);
	Spline->AddSplinePoint(Start, ESplineCoordinateSpace::World, false);
	Spline->AddSplinePoint(End, ESplineCoordinateSpace::World, false);
	Spline->UpdateSpline();

	RebuildVisuals();
}

void AConveyorBelt::RebuildVisuals()
{
	for (USplineMeshComponent* Segment : SegmentMeshes)
	{
		if (Segment)
		{
			Segment->DestroyComponent();
		}
	}
	SegmentMeshes.Reset();

	if (!SegmentMesh)
	{
		return;
	}

	const float BeltLength = Spline->GetSplineLength();
	const float SegmentLength = 200.0f;
	const int32 NumSegments = FMath::Max(1, FMath::CeilToInt32(BeltLength / SegmentLength));

	for (int32 i = 0; i < NumSegments; ++i)
	{
		const float StartDist = i * SegmentLength;
		const float EndDist = FMath::Min(StartDist + SegmentLength, BeltLength);

		USplineMeshComponent* Segment = NewObject<USplineMeshComponent>(this);
		Segment->SetMobility(EComponentMobility::Movable);
		Segment->SetStaticMesh(SegmentMesh);
		Segment->SetForwardAxis(ESplineMeshAxis::X, false);
		// Cubo de 100 uu: 0.8 de largura (80 uu), 0.1 de espessura (10 uu).
		Segment->SetStartScale(FVector2D(0.8f, 0.1f), false);
		Segment->SetEndScale(FVector2D(0.8f, 0.1f), false);
		Segment->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
		Segment->AttachToComponent(Spline, FAttachmentTransformRules::KeepRelativeTransform);

		const FVector StartPos =
			Spline->GetLocationAtDistanceAlongSpline(StartDist, ESplineCoordinateSpace::Local);
		const FVector EndPos =
			Spline->GetLocationAtDistanceAlongSpline(EndDist, ESplineCoordinateSpace::Local);
		const FVector StartTangent =
			Spline->GetTangentAtDistanceAlongSpline(StartDist, ESplineCoordinateSpace::Local)
				.GetClampedToMaxSize(EndDist - StartDist);
		const FVector EndTangent =
			Spline->GetTangentAtDistanceAlongSpline(EndDist, ESplineCoordinateSpace::Local)
				.GetClampedToMaxSize(EndDist - StartDist);

		Segment->SetStartAndEnd(StartPos, StartTangent, EndPos, EndTangent, true);
		Segment->RegisterComponent();
		SegmentMeshes.Add(Segment);
	}
}

void AConveyorBelt::UpdateItemsVisual()
{
	ItemsVisual->ClearInstances();

	for (const FConveyorItem& Item : ItemsInTransit)
	{
		const FVector Location = Spline->GetLocationAtDistanceAlongSpline(
			Item.Distance, ESplineCoordinateSpace::Local) + FVector(0, 0, 30.0f);
		FTransform InstanceTransform(FRotator::ZeroRotator, Location, FVector(0.35f));
		ItemsVisual->AddInstance(InstanceTransform);
	}
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
