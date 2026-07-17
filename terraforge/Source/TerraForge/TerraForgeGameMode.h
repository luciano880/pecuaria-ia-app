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

private:
	void SpawnDemoFactory();

	/** Altura do chão em (X,Y) via trace; retorna DefaultZ se não achar nada. */
	float GetGroundZ(float X, float Y, float DefaultZ = 0.0f) const;

	template <typename T>
	T* SpawnAt(const FVector& Location, float HalfHeight)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride =
			ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		return GetWorld()->SpawnActor<T>(
			T::StaticClass(), Location + FVector(0, 0, HalfHeight), FRotator::ZeroRotator, Params);
	}
};
