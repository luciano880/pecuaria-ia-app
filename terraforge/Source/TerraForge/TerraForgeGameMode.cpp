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

	if (bSpawnDemoFactory)
	{
		SpawnDemoFactory();
	}
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
	AResourceNode* IronNode = SpawnAt<AResourceNode>(GetWorld(), GroundAt(BaseX, BaseY), 30.0f);
	if (IronNode)
	{
		IronNode->OreType = IronOre;
	}
	AMinerMachine* Miner = SpawnAt<AMinerMachine>(GetWorld(), GroundAt(BaseX, BaseY), 110.0f);
	if (Miner)
	{
		Miner->TargetNode = IronNode;
	}

	// Fundição a 8 m, com receita ferro → lingote.
	ASmelterMachine* Smelter = SpawnAt<ASmelterMachine>(GetWorld(), GroundAt(BaseX + 800.0f, BaseY), 100.0f);
	if (Smelter)
	{
		Smelter->ActiveRecipe.InputItem = IronOre;
		Smelter->ActiveRecipe.InputCount = 1;
		Smelter->ActiveRecipe.OutputItem = IronIngot;
		Smelter->ActiveRecipe.OutputCount = 1;
	}

	// Hub Êxodo a 16 m.
	AExodusHub* Hub = SpawnAt<AExodusHub>(GetWorld(), GroundAt(BaseX + 1600.0f, BaseY), 50.0f);

	// Usina de biomassa ao lado, já abastecida com 100 de combustível.
	AGeneratorMachine* Generator =
		SpawnAt<AGeneratorMachine>(GetWorld(), GroundAt(BaseX, BaseY + 800.0f), 150.0f);
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
