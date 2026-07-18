#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TerrainGenerator.generated.h"

class UProceduralMeshComponent;
class UStaticMeshComponent;
class UInstancedStaticMeshComponent;

/**
 * Planeta procedural estilo Terra: terreno com relevo por ruído (Perlin em
 * camadas), biomas por altitude + umidade (praia, campo, floresta, cerrado,
 * rocha, neve), rios cavados no relevo, mar/lagos abaixo do nível d'água e
 * florestas instanciadas. A área central é aplainada para a base do jogador.
 *
 * Visual: cores por vértice (low-poly estilizado) — texturas reais entram
 * depois via Landscape/materiais no editor.
 */
UCLASS()
class TERRAFORGE_API ATerrainGenerator : public AActor
{
	GENERATED_BODY()

public:
	ATerrainGenerator();

	virtual void BeginPlay() override;

	/** Lado do mundo em uu (40000 = 400 m). */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = 5000))
	float WorldSize = 40000.0f;

	/** Vértices por lado da malha (150 => ~22 mil vértices). */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = 20, ClampMax = 400))
	int32 Resolution = 150;

	/** Altura máxima das montanhas, em uu. */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	float MaxHeight = 2600.0f;

	/** Cota do mar/lagos/rios, em uu. */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	float WaterLevel = -150.0f;

	/** Raio central plano para a base (uu) e onde termina a transição. */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	float FlatRadius = 3000.0f;

	UPROPERTY(EditAnywhere, Category = "Terrain")
	float BlendRadius = 5500.0f;

	/** Mesma semente = mesmo planeta. */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	int32 Seed = 1337;

	/** Quantidade máxima de árvores nas florestas. */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = 0))
	int32 MaxTrees = 500;

	/**
	 * Material com texturas reais para o terreno (criado no editor com assets
	 * da Fab — ver docs/TEXTURAS_FAB.md). Se vazio, o gerador procura por
	 * /Game/TerraForge/M_Terrain e, em último caso, usa cores por vértice.
	 */
	UPROPERTY(EditAnywhere, Category = "Terrain")
	TSoftObjectPtr<UMaterialInterface> TerrainMaterial;

	/** Tamanho do tile das texturas em uu (1000 = repete a cada 10 m). */
	UPROPERTY(EditAnywhere, Category = "Terrain", meta = (ClampMin = 100))
	float TextureTileSize = 1000.0f;

	/** (Re)gera a malha do terreno, água e florestas. */
	UFUNCTION(BlueprintCallable, Category = "Terrain")
	void Generate();

	/** Altura do terreno em (X,Y) — usável por outros sistemas. */
	UFUNCTION(BlueprintPure, Category = "Terrain")
	float SampleHeight(float X, float Y) const;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Terrain")
	TObjectPtr<UProceduralMeshComponent> TerrainMesh;

	UPROPERTY(VisibleAnywhere, Category = "Terrain")
	TObjectPtr<UStaticMeshComponent> WaterPlane;

	UPROPERTY(VisibleAnywhere, Category = "Terrain")
	TObjectPtr<UInstancedStaticMeshComponent> TreeTrunks;

	UPROPERTY(VisibleAnywhere, Category = "Terrain")
	TObjectPtr<UInstancedStaticMeshComponent> TreeCanopies;

private:
	bool bGenerated = false;

	float SampleMoisture(float X, float Y) const;
	FLinearColor BiomeColor(float X, float Y, float Height, float Slope) const;
	void ScatterTrees();
	void ApplyMaterials();
};
