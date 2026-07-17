#include "Machines/RenewableGenerator.h"
#include "Components/StaticMeshComponent.h"
#include "Power/PowerGridSubsystem.h"

ARenewableGenerator::ARenewableGenerator()
{
	MachineName = NSLOCTEXT("TerraForge", "RenewableName", "Gerador Renovável");
	MachineTint = FLinearColor(0.9f, 0.9f, 0.95f); // branco turbina
	Mesh->SetStaticMesh(nullptr);

	// --- Eólica: poste + nacele + rotor com 3 pás ---
	WindParts.Add(CreatePart("WindPole", CylinderMeshAsset,
		FVector(0, 0, 300), FVector(0.35f, 0.35f, 6.0f), FRotator::ZeroRotator, false));
	WindParts.Add(CreatePart("WindNacelle", CubeMeshAsset,
		FVector(0, 0, 620), FVector(0.6f, 0.45f, 0.45f)));

	Rotor = CreateDefaultSubobject<USceneComponent>(TEXT("WindRotor"));
	Rotor->SetupAttachment(Mesh);
	Rotor->SetRelativeLocation(FVector(45, 0, 620));
	for (int32 i = 0; i < 3; ++i)
	{
		const float Roll = i * 120.0f;
		const FVector BladeOffset =
			FRotator(0.0f, 0.0f, Roll).RotateVector(FVector(0, 0, 140));
		UStaticMeshComponent* Blade = CreateDefaultSubobject<UStaticMeshComponent>(
			*FString::Printf(TEXT("WindBlade%d"), i));
		Blade->SetupAttachment(Rotor);
		Blade->SetStaticMesh(CubeMeshAsset);
		Blade->SetRelativeLocation(BladeOffset);
		Blade->SetRelativeRotation(FRotator(0.0f, 0.0f, Roll));
		Blade->SetRelativeScale3D(FVector(0.1f, 0.35f, 2.8f));
		WindParts.Add(Blade);
	}

	// --- Solar: pedestal + painel inclinado ---
	SolarParts.Add(CreatePart("SolarPedestal", CylinderMeshAsset,
		FVector(0, 0, 60), FVector(0.3f, 0.3f, 1.2f)));
	SolarParts.Add(CreatePart("SolarPanel", CubeMeshAsset,
		FVector(0, 0, 170), FVector(2.6f, 3.2f, 0.08f), FRotator(-25.0f, 0.0f, 0.0f), false));

	// --- Geotérmica: domo sobre o gêiser + tubulação ---
	GeoParts.Add(CreatePart("GeoDome", SphereMeshAsset,
		FVector(0, 0, 60), FVector(2.0f, 2.0f, 1.3f), FRotator::ZeroRotator, false));
	GeoParts.Add(CreatePart("GeoPipe", CylinderMeshAsset,
		FVector(120, 0, 140), FVector(0.3f, 0.3f, 2.6f)));
	GeoParts.Add(CreatePart("GeoValve", CubeMeshAsset,
		FVector(120, 0, 280), FVector(0.5f, 0.5f, 0.4f)));
}

void ARenewableGenerator::BeginPlay()
{
	Super::BeginPlay();
	ApplySourceTypeVisual();
}

void ARenewableGenerator::ApplySourceTypeVisual()
{
	auto SetPartsActive = [](const TArray<TObjectPtr<UStaticMeshComponent>>& Parts, bool bActive)
	{
		for (UStaticMeshComponent* Part : Parts)
		{
			if (Part)
			{
				Part->SetVisibility(bActive);
				Part->SetCollisionEnabled(
					bActive ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
			}
		}
	};

	SetPartsActive(WindParts, SourceType == ERenewableType::Wind);
	SetPartsActive(SolarParts, SourceType == ERenewableType::Solar);
	SetPartsActive(GeoParts, SourceType == ERenewableType::Geothermal);
}

void ARenewableGenerator::Tick(float DeltaSeconds)
{
	// Pula o ciclo de produção de AMachineBase: gerador produz MW, não itens.
	AActor::Tick(DeltaSeconds);

	const float Factor = ComputeCapacityFactor(GetWorld()->GetTimeSeconds());
	SetGridOutput(PeakOutputMW * Factor);

	// Pás giram proporcionais ao vento.
	if (Rotor && SourceType == ERenewableType::Wind)
	{
		Rotor->AddLocalRotation(FRotator(0.0f, 0.0f, 140.0f * DeltaSeconds * Factor));
	}
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
