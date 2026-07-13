#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Items/ItemData.h"
#include "MachineBase.generated.h"

/** Parâmetros de uma máquina em um tier específico (Mk1, Mk2...). */
USTRUCT(BlueprintType)
struct TERRAFORGE_API FMachineTierSpec
{
	GENERATED_BODY()

	/** Segundos por ciclo de produção. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 0.01))
	float CycleTime = 4.0f;

	/** Itens produzidos por ciclo. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 1))
	int32 ItemsPerCycle = 1;

	/** Consumo elétrico em MW (0 = máquina manual/a combustível). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 0))
	float PowerConsumptionMW = 0.0f;

	/** Poluição gerada por minuto de operação. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 0))
	float PollutionPerMinute = 0.0f;

	/** Custo de upgrade PARA este tier. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite)
	TArray<FItemStack> UpgradeCost;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnMachineUpgraded, int32, NewTier);

/**
 * Base de todas as máquinas (mineradora, fundição, gerador...).
 * Cuida de: tier/upgrade, buffers de entrada/saída, energia e ciclo de produção.
 */
UCLASS(Abstract)
class TERRAFORGE_API AMachineBase : public AActor
{
	GENERATED_BODY()

public:
	AMachineBase();

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaSeconds) override;

	// --- Tier / upgrade ---

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Machine")
	FText MachineName;

	/** Specs por tier; índice 0 = Mk1. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Machine")
	TArray<FMachineTierSpec> TierSpecs;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Machine")
	int32 CurrentTier = 0;

	UFUNCTION(BlueprintPure, Category = "Machine")
	const FMachineTierSpec& GetCurrentSpec() const;

	UFUNCTION(BlueprintPure, Category = "Machine")
	bool CanUpgrade() const { return TierSpecs.IsValidIndex(CurrentTier + 1); }

	/**
	 * Faz upgrade in-place para o próximo tier, consumindo o custo do inventário dado.
	 * @return true se o upgrade aconteceu.
	 */
	UFUNCTION(BlueprintCallable, Category = "Machine")
	bool TryUpgrade(UPARAM(ref) TArray<FItemStack>& PayerInventory);

	UPROPERTY(BlueprintAssignable, Category = "Machine")
	FOnMachineUpgraded OnMachineUpgraded;

	// --- Buffers ---

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Machine|Buffers")
	TArray<FItemStack> InputBuffer;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Machine|Buffers")
	TArray<FItemStack> OutputBuffer;

	/** Capacidade máxima total (em itens) de cada buffer. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Machine|Buffers", meta = (ClampMin = 1))
	int32 BufferCapacity = 100;

	UFUNCTION(BlueprintCallable, Category = "Machine|Buffers")
	int32 AddToBuffer(UPARAM(ref) TArray<FItemStack>& Buffer, UItemData* Item, int32 Count);

	UFUNCTION(BlueprintCallable, Category = "Machine|Buffers")
	int32 RemoveFromBuffer(UPARAM(ref) TArray<FItemStack>& Buffer, UItemData* Item, int32 Count);

	UFUNCTION(BlueprintPure, Category = "Machine|Buffers")
	int32 CountInBuffer(const TArray<FItemStack>& Buffer, const UItemData* Item) const;

	// --- Energia ---

	/** Eficiência atual [0..1] definida pela rede elétrica (1 se não usa energia). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Machine|Power")
	float GridEfficiency = 1.0f;

	UFUNCTION(BlueprintPure, Category = "Machine|Power")
	float GetPowerDemandMW() const { return GetCurrentSpec().PowerConsumptionMW; }

protected:
	/** Progresso do ciclo atual [0..CycleTime). */
	float CycleProgress = 0.0f;

	/** Retorna true se a máquina tem insumos/condições para produzir agora. */
	virtual bool CanProduce() const { return true; }

	/** Executa um ciclo de produção completo (consumir insumos, gerar saída). */
	virtual void ProduceCycle() {}

	UPROPERTY(VisibleAnywhere, Category = "Machine")
	TObjectPtr<UStaticMeshComponent> Mesh;
};
