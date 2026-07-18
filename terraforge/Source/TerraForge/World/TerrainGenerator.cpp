#include "World/TerrainGenerator.h"
#include "ProceduralMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"
#include "TerraForge.h"

ATerrainGenerator::ATerrainGenerator()
{
	PrimaryActorTick.bCanEverTick = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	TerrainMesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("TerrainMesh"));
	TerrainMesh->SetupAttachment(Root);
	TerrainMesh->SetCollisionProfileName(TEXT("BlockAll"));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(
		TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(
		TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));

	WaterPlane = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("WaterPlane"));
	WaterPlane->SetupAttachment(Root);
	if (CubeMesh.Succeeded())
	{
		WaterPlane->SetStaticMesh(CubeMesh.Object);
	}
	WaterPlane->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	TreeTrunks = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("TreeTrunks"));
	TreeTrunks->SetupAttachment(Root);
	if (CylinderMesh.Succeeded())
	{
		TreeTrunks->SetStaticMesh(CylinderMesh.Object);
	}
	TreeTrunks->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	TreeCanopies = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("TreeCanopies"));
	TreeCanopies->SetupAttachment(Root);
	if (SphereMesh.Succeeded())
	{
		TreeCanopies->SetStaticMesh(SphereMesh.Object);
	}
	TreeCanopies->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void ATerrainGenerator::BeginPlay()
{
	Super::BeginPlay();

	if (!bGenerated)
	{
		Generate();
	}
}

float ATerrainGenerator::SampleHeight(float X, float Y) const
{
	const FVector2D P(X, Y);
	const float SeedF = Seed * 0.6180339f; // deslocamentos determinísticos por semente

	// Camadas de relevo: continentes -> colinas -> detalhe.
	const float Continents =
		FMath::PerlinNoise2D(P / 18000.0f + FVector2D(SeedF * 13.3f, SeedF * 7.7f));
	const float Hills =
		FMath::PerlinNoise2D(P / 5000.0f + FVector2D(SeedF * 31.1f, SeedF * 17.9f));
	const float Detail =
		FMath::PerlinNoise2D(P / 1200.0f + FVector2D(SeedF * 53.7f, SeedF * 41.3f));

	float Height = (0.55f * Continents + 0.32f * Hills + 0.13f * Detail) * MaxHeight;

	// Rios: onde o ruído de rio cruza o zero, o relevo é cavado abaixo da água.
	const float RiverNoise =
		FMath::PerlinNoise2D(P / 9000.0f + FVector2D(SeedF * 71.3f, SeedF * 23.1f));
	const float RiverMask = FMath::Abs(RiverNoise);
	if (RiverMask < 0.06f && Height > WaterLevel - 200.0f)
	{
		const float Carve = 1.0f - RiverMask / 0.06f; // 1 no centro do rio
		Height = FMath::Lerp(Height, WaterLevel - 250.0f, Carve * 0.9f);
	}

	// Área central plana para a base do jogador (planalto seco em Z = 30).
	const float DistFromCenter = FMath::Sqrt(X * X + Y * Y);
	const float Blend = FMath::SmoothStep(FlatRadius, BlendRadius, DistFromCenter);
	Height = FMath::Lerp(30.0f, Height, Blend);

	return Height;
}

float ATerrainGenerator::SampleMoisture(float X, float Y) const
{
	const float SeedF = Seed * 0.6180339f;
	const float Noise = FMath::PerlinNoise2D(
		FVector2D(X, Y) / 8000.0f + FVector2D(SeedF * 91.7f, SeedF * 67.9f));
	return 0.5f + 0.5f * Noise; // [0..1]
}

FLinearColor ATerrainGenerator::BiomeColor(float X, float Y, float Height, float Slope) const
{
	// Praia perto da água, neve no topo, rocha em encostas e alturas.
	if (Height < WaterLevel + 60.0f)
	{
		return FLinearColor(0.78f, 0.72f, 0.50f); // areia
	}
	if (Height > 1750.0f)
	{
		return FLinearColor(0.93f, 0.94f, 0.97f); // neve
	}
	if (Height > 1150.0f || Slope > 0.55f)
	{
		return FLinearColor(0.42f, 0.40f, 0.40f); // rocha
	}

	const float Moisture = SampleMoisture(X, Y);
	if (Moisture > 0.62f)
	{
		return FLinearColor(0.10f, 0.34f, 0.12f); // floresta
	}
	if (Moisture < 0.35f)
	{
		return FLinearColor(0.58f, 0.55f, 0.24f); // cerrado seco
	}
	return FLinearColor(0.28f, 0.52f, 0.18f); // campo
}

void ATerrainGenerator::Generate()
{
	bGenerated = true;

	const int32 N = Resolution;
	const float Half = WorldSize * 0.5f;
	const float Cell = WorldSize / (N - 1);

	TArray<FVector> Vertices;
	TArray<FVector> Normals;
	TArray<FVector2D> UVs;
	TArray<FLinearColor> Colors;
	TArray<int32> Triangles;
	Vertices.Reserve(N * N);
	Normals.Reserve(N * N);
	UVs.Reserve(N * N);
	Colors.Reserve(N * N);
	Triangles.Reserve((N - 1) * (N - 1) * 6);

	for (int32 GY = 0; GY < N; ++GY)
	{
		for (int32 GX = 0; GX < N; ++GX)
		{
			const float X = -Half + GX * Cell;
			const float Y = -Half + GY * Cell;
			const float H = SampleHeight(X, Y);

			// Normal e inclinação por diferenças finitas.
			const float HX = SampleHeight(X + Cell, Y) - SampleHeight(X - Cell, Y);
			const float HY = SampleHeight(X, Y + Cell) - SampleHeight(X, Y - Cell);
			FVector Normal(-HX / (2.0f * Cell), -HY / (2.0f * Cell), 1.0f);
			Normal.Normalize();
			const float Slope = 1.0f - Normal.Z;

			Vertices.Add(FVector(X, Y, H));
			Normals.Add(Normal);
			// UVs em espaço de mundo tilado: qualquer material com textura
			// repete naturalmente a cada TextureTileSize uu.
			UVs.Add(FVector2D(X, Y) / TextureTileSize);
			Colors.Add(BiomeColor(X, Y, H, Slope));
		}
	}

	for (int32 GY = 0; GY < N - 1; ++GY)
	{
		for (int32 GX = 0; GX < N - 1; ++GX)
		{
			const int32 I = GY * N + GX;
			Triangles.Add(I);
			Triangles.Add(I + N);
			Triangles.Add(I + 1);
			Triangles.Add(I + 1);
			Triangles.Add(I + N);
			Triangles.Add(I + N + 1);
		}
	}

	TerrainMesh->ClearAllMeshSections();
	TerrainMesh->CreateMeshSection_LinearColor(0, Vertices, Triangles, Normals, UVs,
		Colors, TArray<FProcMeshTangent>(), /*bCreateCollision*/ true);

	// Espelho d'água cobrindo o mundo inteiro na cota do mar.
	WaterPlane->SetRelativeLocation(FVector(0, 0, WaterLevel - 5.0f));
	WaterPlane->SetRelativeScale3D(FVector(WorldSize / 100.0f, WorldSize / 100.0f, 0.1f));

	ScatterTrees();
	ApplyMaterials();

	UE_LOG(LogTerraForge, Log,
		TEXT("Planeta gerado: %dx%d vértices, água em %.0f, %d árvores (semente %d)"),
		N, N, WaterLevel, TreeTrunks->GetInstanceCount(), Seed);
}

void ATerrainGenerator::ScatterTrees()
{
	TreeTrunks->ClearInstances();
	TreeCanopies->ClearInstances();

	// Árvore real (Fab/Megaplants): propriedade ou convenção
	// /Game/TerraForge/SM_Tree. Sem ela, árvores procedurais tronco+copa.
	UStaticMesh* RealTree = TreeMesh.LoadSynchronous();
	if (!RealTree)
	{
		RealTree = LoadObject<UStaticMesh>(nullptr,
			TEXT("/Game/TerraForge/SM_Tree.SM_Tree"));
	}
	if (RealTree)
	{
		TreeTrunks->SetStaticMesh(RealTree);
		UE_LOG(LogTerraForge, Log, TEXT("Florestas usando árvore real: %s"),
			*RealTree->GetName());
	}

	FRandomStream Rand(Seed * 7 + 1);
	const float Half = WorldSize * 0.5f - 500.0f;

	int32 Planted = 0;
	for (int32 Try = 0; Try < MaxTrees * 4 && Planted < MaxTrees; ++Try)
	{
		const float X = Rand.FRandRange(-Half, Half);
		const float Y = Rand.FRandRange(-Half, Half);
		const float H = SampleHeight(X, Y);

		// Floresta: acima da água, abaixo da rocha, bioma úmido, fora da base.
		if (H < WaterLevel + 100.0f || H > 1100.0f)
		{
			continue;
		}
		if (SampleMoisture(X, Y) <= 0.58f)
		{
			continue;
		}
		if (FMath::Sqrt(X * X + Y * Y) < FlatRadius * 0.8f)
		{
			continue;
		}

		const float Size = Rand.FRandRange(0.8f, 1.4f);
		const FRotator Facing(0, Rand.FRandRange(0, 360), 0);

		if (RealTree)
		{
			// Árvores da Megaplant já vêm em escala real: só varia o tamanho.
			TreeTrunks->AddInstance(FTransform(Facing, FVector(X, Y, H),
				FVector(Size)));
		}
		else
		{
			TreeTrunks->AddInstance(FTransform(Facing, FVector(X, Y, H),
				FVector(0.28f * Size, 0.28f * Size, 2.8f * Size)));
			TreeCanopies->AddInstance(FTransform(
				FRotator::ZeroRotator,
				FVector(X, Y, H + 300.0f * Size),
				FVector(2.0f * Size, 2.0f * Size, 1.7f * Size)));
		}
		++Planted;
	}
}

void ATerrainGenerator::ApplyMaterials()
{
	// Prioridade: 1) material com texturas definido na propriedade;
	// 2) material por convenção em /Game/TerraForge/M_Terrain (criado no
	//    editor com texturas da Fab — ver docs/TEXTURAS_FAB.md);
	// 3) fallback: cores por vértice (biomas em low-poly).
	UMaterialInterface* Material = TerrainMaterial.LoadSynchronous();
	if (!Material)
	{
		Material = LoadObject<UMaterialInterface>(nullptr,
			TEXT("/Game/TerraForge/M_Terrain.M_Terrain"));
	}
	if (Material)
	{
		UE_LOG(LogTerraForge, Log, TEXT("Terreno usando material com texturas: %s"),
			*Material->GetName());
	}
	else
	{
		Material = LoadObject<UMaterialInterface>(nullptr,
			TEXT("/Engine/EngineDebugMaterials/VertexColorMaterial.VertexColorMaterial"));
		if (!Material)
		{
			Material = LoadObject<UMaterialInterface>(nullptr,
				TEXT("/Engine/EngineDebugMaterials/VertexColorViewMode_ColorOnly.VertexColorViewMode_ColorOnly"));
		}
	}
	if (Material)
	{
		TerrainMesh->SetMaterial(0, Material);
	}

	auto Tint = [](UStaticMeshComponent* Component, const FLinearColor& Color)
	{
		if (Component && Component->GetStaticMesh())
		{
			if (UMaterialInstanceDynamic* MID =
				Component->CreateAndSetMaterialInstanceDynamic(0))
			{
				MID->SetVectorParameterValue(TEXT("Color"), Color);
			}
		}
	};

	Tint(WaterPlane, FLinearColor(0.03f, 0.18f, 0.42f)); // azul oceano

	// Só pinta as árvores procedurais; árvores reais (Megaplants) mantêm o
	// material próprio (o caminho real deixa as copas sem instâncias).
	if (TreeCanopies->GetInstanceCount() > 0)
	{
		Tint(TreeTrunks, FLinearColor(0.28f, 0.18f, 0.10f));   // tronco marrom
		Tint(TreeCanopies, FLinearColor(0.10f, 0.38f, 0.14f)); // copa verde
	}
}
