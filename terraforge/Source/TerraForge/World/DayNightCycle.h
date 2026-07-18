#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "DayNightCycle.generated.h"

class ADirectionalLight;

/**
 * Ciclo dia/noite: gira o sol do mapa ao longo de DayLengthSeconds.
 * A intensidade acompanha a elevação (entardecer alaranjado suave) e a noite
 * mantém um "luar" mínimo para o jogo nunca ficar escuro demais.
 */
UCLASS()
class TERRAFORGE_API ADayNightCycle : public AActor
{
	GENERATED_BODY()

public:
	ADayNightCycle();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Duração do dia completo (dia + noite), em segundos. */
	UPROPERTY(EditAnywhere, Category = "DayNight", meta = (ClampMin = 30))
	float DayLengthSeconds = 900.0f;

	/** Hora inicial [0..1]: 0.25 = manhã, 0.5 = meio-dia. */
	UPROPERTY(EditAnywhere, Category = "DayNight", meta = (ClampMin = 0, ClampMax = 1))
	float StartTimeOfDay = 0.35f;

	/** Intensidade do sol a pino. */
	UPROPERTY(EditAnywhere, Category = "DayNight")
	float NoonIntensity = 8.0f;

	/** Intensidade mínima à noite (luar). */
	UPROPERTY(EditAnywhere, Category = "DayNight")
	float NightIntensity = 0.5f;

	/** Fração do dia atual [0..1], para UI/relógio. */
	UFUNCTION(BlueprintPure, Category = "DayNight")
	float GetTimeOfDay() const { return TimeOfDay; }

private:
	float TimeOfDay = 0.35f;

	UPROPERTY(Transient)
	TObjectPtr<ADirectionalLight> Sun;

	void FindSun();
};
