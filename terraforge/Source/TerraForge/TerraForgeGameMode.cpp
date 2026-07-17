#include "TerraForgeGameMode.h"
#include "Player/TerraForgeCharacter.h"
#include "Items/GameDataSubsystem.h"
#include "Items/ItemData.h"
#include "Resources/ResourceNode.h"
#include "Machines/MinerMachine.h"
#include "Machines/SmelterMachine.h"
#include "Machines/GeneratorMachine.h"
#include "Logistics/ConveyorBelt.h"
#include "Progression/ExodusHub.h"
#include "Engine/World.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/DirectionalLight.h"
#include "Components/LightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "TerraForge.h"

namespace
{
	/** Spawna um ator com a base apoiada em Location (elevado por HalfHeight). */
	template <typename T>
	T* SpawnAt(UWorld* World, const FVector& Location, float HalfHeight)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride =
			ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		return World->SpawnActor<T>(
			T::StaticClass(), Location + FVector(0, 0, HalfHeight),
			FRotator::ZeroRotator, Params);
	}
}

ATerraForgeGameMode::ATerraForgeGameMode()
{
	// O Blueprint filho (BP_TerraForgeGameMode) pode trocar pelo BP_Character
	// com os assets de input e malhas configurados.
	DefaultPawnClass = ATerraForgeCharacter::StaticClass();
}

void ATerraForgeGameMode::BeginPlay()
{
	Super::BeginPlay();

	EnsureWorldEnvironment();

	if (bGenerateResourceVeins)
	{
		GenerateResourceVeins();
	}

	if (bSpawnDemoFactory)
	{
		SpawnDemoFactory();
	}
}

void ATerraForgeGameMode::GenerateResourceVeins()
{
	UGameDataSubsystem* Data = GetGameInstance()->GetSubsystem<UGameDataSubsystem>();
	if (!Data)
	{
		return;
	}

	FRandomStream Rand(WorldSeed);

	// Um cluster = várias jazidas próximas. Distância cresce com a raridade,
	// criando a progressão de exploração: ferro/carvão perto, cobre/calcário
	// médio, gêiseres longe.
	struct FVeinCluster
	{
		FName OreId;
		float AngleDeg;
		float Distance;
		int32 Count;
		bool bGeyser;
	};
	const FVeinCluster Clusters[] = {
		{ "MinerioFerro",  20.0f,  4000.0f, 4, false },
		{ "Carvao",       -50.0f,  5000.0f, 4, false },
		{ "MinerioFerro", 140.0f,  6500.0f, 3, false },
		{ "MinerioCobre",  75.0f,  9000.0f, 3, false },
		{ "Calcario",     200.0f,  8000.0f, 3, false },
		{ "MinerioCobre", 250.0f, 11000.0f, 3, false },
		{ "Carvao",       310.0f,  9500.0f, 3, false },
		{ NAME_None,      110.0f, 12000.0f, 1, true },
		{ NAME_None,      290.0f, 13000.0f, 1, true },
	};

	int32 TotalNodes = 0;
	for (const FVeinCluster& Cluster : Clusters)
	{
		const float Angle = FMath::DegreesToRadians(Cluster.AngleDeg + Rand.FRandRange(-10, 10));
		const FVector2D Center(
			FMath::Cos(Angle) * Cluster.Distance,
			FMath::Sin(Angle) * Cluster.Distance);

		for (int32 i = 0; i < Cluster.Count; ++i)
		{
			const FVector2D Offset(Rand.FRandRange(-800, 800), Rand.FRandRange(-800, 800));
			const float X = Center.X + Offset.X;
			const float Y = Center.Y + Offset.Y;
			const FVector Location(X, Y, GetGroundZ(X, Y) + 15.0f);

			AResourceNode* Node = GetWorld()->SpawnActorDeferred<AResourceNode>(
				AResourceNode::StaticClass(), FTransform(Location));
			if (!Node)
			{
				continue;
			}

			if (Cluster.bGeyser)
			{
				Node->bIsGeyser = true;
			}
			else
			{
				Node->OreType = Data->GetItem(Cluster.OreId);

				// Pureza sorteada: 30% impura, 50% normal, 20% pura.
				const float Roll = Rand.FRand();
				Node->Purity = Roll < 0.3f ? ENodePurity::Impure
					: Roll < 0.8f ? ENodePurity::Normal : ENodePurity::Pure;
			}

			Node->FinishSpawning(FTransform(Location));
			++TotalNodes;
		}
	}

	// Rochas decorativas espalhadas (dão vida ao terreno plano).
	if (UStaticMesh* Sphere =
		LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere")))
	{
		for (int32 i = 0; i < 40; ++i)
		{
			const float Angle = Rand.FRand() * 2.0f * PI;
			const float Distance = Rand.FRandRange(2500.0f, 14000.0f);
			const float X = FMath::Cos(Angle) * Distance;
			const float Y = FMath::Sin(Angle) * Distance;

			AStaticMeshActor* Rock = GetWorld()->SpawnActor<AStaticMeshActor>();
			if (!Rock)
			{
				continue;
			}
			Rock->SetMobility(EComponentMobility::Movable);
			Rock->GetStaticMeshComponent()->SetStaticMesh(Sphere);
			const float Size = Rand.FRandRange(0.6f, 2.2f);
			Rock->SetActorScale3D(FVector(Size, Size * Rand.FRandRange(0.7f, 1.3f), Size * 0.6f));
			Rock->SetActorLocation(FVector(X, Y, GetGroundZ(X, Y) + 20.0f));
			if (UMaterialInstanceDynamic* MID =
				Rock->GetStaticMeshComponent()->CreateAndSetMaterialInstanceDynamic(0))
			{
				const float Gray = Rand.FRandRange(0.25f, 0.5f);
				MID->SetVectorParameterValue(TEXT("Color"), FLinearColor(Gray, Gray, Gray));
			}
		}
	}

	UE_LOG(LogTerraForge, Log,
		TEXT("Mapa gerado (semente %d): %d jazidas em clusters + gêiseres + rochas"),
		WorldSeed, TotalNodes);
}

void ATerraForgeGameMode::EnsureWorldEnvironment()
{
	// Se um trace para baixo acha chão, o mapa já é utilizável.
	FHitResult Hit;
	const bool bHasGround = GetWorld()->LineTraceSingleByChannel(Hit,
		FVector(DemoOrigin.X, DemoOrigin.Y, 10000.0f),
		FVector(DemoOrigin.X, DemoOrigin.Y, -10000.0f), ECC_Visibility);
	if (bHasGround)
	{
		return;
	}

	UE_LOG(LogTerraForge, Warning,
		TEXT("Mapa vazio detectado: criando chão e iluminação básicos por código"));

	// Chão: cubo do engine esticado em 400x400 m, topo em Z = 0.
	if (UStaticMesh* Cube =
		LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")))
	{
		if (AStaticMeshActor* Floor = GetWorld()->SpawnActor<AStaticMeshActor>())
		{
			Floor->SetMobility(EComponentMobility::Movable);
			Floor->GetStaticMeshComponent()->SetStaticMesh(Cube);
			Floor->SetActorScale3D(FVector(400.0f, 400.0f, 1.0f));
			Floor->SetActorLocation(FVector(0.0f, 0.0f, -50.0f));
		}
	}

	// Sol principal com sombras.
	if (ADirectionalLight* Sun = GetWorld()->SpawnActor<ADirectionalLight>())
	{
		Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);
		Sun->SetActorRotation(FRotator(-50.0f, 30.0f, 0.0f));
		Sun->GetLightComponent()->SetIntensity(8.0f);
	}

	// Luz de preenchimento fraca do lado oposto (sem sombra), para os lados
	// escuros das máquinas não ficarem pretos num mapa sem céu.
	if (ADirectionalLight* Fill = GetWorld()->SpawnActor<ADirectionalLight>())
	{
		Fill->GetLightComponent()->SetMobility(EComponentMobility::Movable);
		Fill->SetActorRotation(FRotator(-30.0f, 210.0f, 0.0f));
		Fill->GetLightComponent()->SetIntensity(2.0f);
		Fill->GetLightComponent()->SetCastShadows(false);
	}
}

float ATerraForgeGameMode::GetGroundZ(float X, float Y, float DefaultZ) const
{
	FHitResult Hit;
	if (GetWorld()->LineTraceSingleByChannel(Hit,
		FVector(X, Y, 10000.0f), FVector(X, Y, -10000.0f), ECC_Visibility))
	{
		return Hit.Location.Z;
	}
	return DefaultZ;
}

void ATerraForgeGameMode::SpawnDemoFactory()
{
	UGameDataSubsystem* Data = GetGameInstance()->GetSubsystem<UGameDataSubsystem>();
	if (!Data)
	{
		return;
	}

	UItemData* IronOre = Data->GetItem("MinerioFerro");
	UItemData* IronIngot = Data->GetItem("LingoteFerro");
	UItemData* Biomass = Data->GetItem("Biomassa");

	const float BaseX = DemoOrigin.X;
	const float BaseY = DemoOrigin.Y;
	auto GroundAt = [this](float X, float Y)
	{
		return FVector(X, Y, GetGroundZ(X, Y));
	};

	// Jazida de ferro + mineradora em cima dela.
	AResourceNode* IronNode = SpawnAt<AResourceNode>(GetWorld(), GroundAt(BaseX, BaseY), 15.0f);
	if (IronNode)
	{
		IronNode->OreType = IronOre;
	}
	AMinerMachine* Miner = SpawnAt<AMinerMachine>(GetWorld(), GroundAt(BaseX, BaseY), 2.0f);
	if (Miner)
	{
		Miner->TargetNode = IronNode;
	}

	// Fundição a 8 m, com receita ferro → lingote.
	ASmelterMachine* Smelter = SpawnAt<ASmelterMachine>(GetWorld(), GroundAt(BaseX + 800.0f, BaseY), 2.0f);
	if (Smelter)
	{
		Smelter->ActiveRecipe.InputItem = IronOre;
		Smelter->ActiveRecipe.InputCount = 1;
		Smelter->ActiveRecipe.OutputItem = IronIngot;
		Smelter->ActiveRecipe.OutputCount = 1;
	}

	// Hub Êxodo a 16 m.
	AExodusHub* Hub = SpawnAt<AExodusHub>(GetWorld(), GroundAt(BaseX + 1600.0f, BaseY), 2.0f);

	// Usina de biomassa ao lado, já abastecida com 100 de combustível.
	AGeneratorMachine* Generator =
		SpawnAt<AGeneratorMachine>(GetWorld(), GroundAt(BaseX, BaseY + 800.0f), 2.0f);
	if (Generator)
	{
		Generator->FuelItem = Biomass;
		Generator->AddToBuffer(Generator->InputBuffer, Biomass, 100);
	}

	// Esteiras ligando tudo.
	if (Miner && Smelter)
	{
		if (AConveyorBelt* Belt = GetWorld()->SpawnActor<AConveyorBelt>())
		{
			Belt->InitializeStraightBelt(Miner, Smelter);
		}
	}
	if (Smelter && Hub)
	{
		if (AConveyorBelt* Belt = GetWorld()->SpawnActor<AConveyorBelt>())
		{
			Belt->InitializeStraightBelt(Smelter, Hub);
		}
	}

	UE_LOG(LogTerraForge, Log,
		TEXT("Fábrica demo montada em (%.0f, %.0f): minere, funda e entregue no Hub!"),
		BaseX, BaseY);
}
