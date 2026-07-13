#pragma once

#include "CoreMinimal.h"
#include "Machines/MachineBase.h"
#include "RenewableGenerator.generated.h"

UENUM(BlueprintType)
enum class ERenewableType : uint8
{
	/** Constante 24h; só pode ser construída sobre um gêiser (AResourceNode especial). */
	Geothermal UMETA(DisplayName = "Geotérmica (gêiser)"),
	/** Segue o ciclo dia/noite: pico ao meio-dia, zero à noite. */
	Solar      UMETA(DisplayName = "Solar"),
	/** Oscila com o vento entre MinWindFactor e 100%. */
	Wind       UMETA(DisplayName = "Eólica")
};

/**
 * Gerador renovável opcional (tier 5): geotérmica, solar e eólica.
 * Não consome combustível; a potência entregue varia com a fonte.
 */
UCLASS()
class TERRAFORGE_API ARenewableGenerator : public AMachineBase
{
	GENERATED_BODY()

public:
	ARenewableGenerator();

	virtual void Tick(float DeltaSeconds) override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Renewable")
	ERenewableType SourceType = ERenewableType::Solar;

	/** Potência máxima (fator de capacidade = 100%). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Renewable", meta = (ClampMin = 0))
	float PeakOutputMW = 40.0f;

	/** Duração do ciclo dia+noite em segundos (usado pela solar). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Renewable|Solar", meta = (ClampMin = 10))
	float DayLengthSeconds = 1200.0f;

	/** Piso da geração eólica quando o vento está fraco [0..1]. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Renewable|Wind",
		meta = (ClampMin = 0, ClampMax = 1))
	float MinWindFactor = 0.3f;

	/** Velocidade de variação do vento (maior = rajadas mais frequentes). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Renewable|Wind", meta = (ClampMin = 0.01))
	float WindVariability = 0.05f;

	/** Potência sendo entregue à rede neste momento. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Renewable")
	float CurrentOutputMW = 0.0f;

	/** Fator de capacidade atual [0..1], para UI. */
	UFUNCTION(BlueprintPure, Category = "Renewable")
	float GetCapacityFactor() const
	{
		return PeakOutputMW > 0.0f ? CurrentOutputMW / PeakOutputMW : 0.0f;
	}

private:
	float ComputeCapacityFactor(float WorldTimeSeconds) const;
	void SetGridOutput(float NewOutputMW);
};
