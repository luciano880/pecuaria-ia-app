#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "TerraForgeGameMode.generated.h"

class AMachineBase;

UCLASS()
class TERRAFORGE_API ATerraForgeGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ATerraForgeGameMode();

	virtual void BeginPlay() override;

	/**
	 * Monta uma fábrica de demonstração ao iniciar o jogo:
	 * jazida de ferro → mineradora → esteira → fundição → esteira → Hub Êxodo,
	 * mais uma usina de biomassa já abastecida. Desligue para mapas reais.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Demo")
	bool bSpawnDemoFactory = true;

	/** Centro da fábrica demo (deslocado do PlayerStart do template). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Demo")
	FVector DemoOrigin = FVector(1500.0f, 0.0f, 0.0f);

	/** Gera veios de minério em clusters pelo mapa (ferro, cobre, carvão...). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Demo")
	bool bGenerateResourceVeins = true;

	/**
	 * Gera o planeta procedural (relevo, biomas, rios, lagos, florestas).
	 * Desligue quando for usar um Landscape feito à mão no editor.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Demo")
	bool bGenerateTerrain = true;

	/** Semente do gerador (mesma semente = mesmo mapa). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Demo")
	int32 WorldSeed = 1337;

private:
	void SpawnDemoFactory();

	/** Espalha clusters de jazidas, gêiseres e rochas decorativas pelo mapa. */
	void GenerateResourceVeins();

	/**
	 * Se o mapa estiver vazio (sem chão), cria chão e iluminação básicos por
	 * código — garante que Play nunca resulte em tela preta.
	 */
	void EnsureWorldEnvironment();

	/** Altura do chão em (X,Y) via trace; retorna DefaultZ se não achar nada. */
	float GetGroundZ(float X, float Y, float DefaultZ = 0.0f) const;
};
