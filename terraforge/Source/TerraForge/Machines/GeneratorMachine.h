#pragma once

#include "CoreMinimal.h"
#include "Machines/MachineBase.h"
#include "GeneratorMachine.generated.h"

/**
 * Gerador de energia a combustível — cobre as 4 fontes principais do jogo,
 * variando apenas a configuração (feita nos Blueprints filhos):
 *
 *   BP_BiomassPlant : FuelItem=Biomassa,        PowerOutputMW=20,  poluição baixa
 *   BP_CoalPlant    : FuelItem=Carvão,          PowerOutputMW=60,  poluição alta
 *   BP_OilPlant     : FuelItem=ÓleoCombustível, PowerOutputMW=120, poluição média
 *   BP_NuclearPlant : FuelItem=BarraDeUrânio,   PowerOutputMW=500, WasteOutput=RejeitolNuclear
 *
 * Consome 1 unidade de combustível do InputBuffer a cada SecondsPerFuelUnit e
 * mantém PowerOutputMW registrado na rede enquanto estiver queimando.
 */
UCLASS()
class TERRAFORGE_API AGeneratorMachine : public AMachineBase
{
	GENERATED_BODY()

public:
	AGeneratorMachine();

	virtual void Tick(float DeltaSeconds) override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	/** Potência entregue à rede enquanto há combustível queimando. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generator", meta = (ClampMin = 0))
	float PowerOutputMW = 20.0f;

	/** Item aceito como combustível. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generator")
	TObjectPtr<UItemData> FuelItem;

	/** Duração da queima de 1 unidade de combustível, em segundos. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generator", meta = (ClampMin = 0.1))
	float SecondsPerFuelUnit = 8.0f;

	/**
	 * Subproduto gerado a cada unidade de combustível consumida.
	 * Usado pela usina nuclear (rejeito radioativo). Deixar vazio nas demais.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Generator")
	FItemStack WasteOutput;

	UFUNCTION(BlueprintPure, Category = "Generator")
	bool IsOnline() const { return bOnline; }

	/** Fração restante da unidade de combustível atual [0..1], para UI. */
	UFUNCTION(BlueprintPure, Category = "Generator")
	float GetFuelFraction() const
	{
		return SecondsPerFuelUnit > 0.0f
			? FMath::Clamp(FuelRemainingSeconds / SecondsPerFuelUnit, 0.0f, 1.0f)
			: 0.0f;
	}

protected:
	bool bOnline = false;
	float FuelRemainingSeconds = 0.0f;

	/** Liga/desliga a contribuição deste gerador na rede elétrica. */
	void SetOnline(bool bNewOnline);
};
