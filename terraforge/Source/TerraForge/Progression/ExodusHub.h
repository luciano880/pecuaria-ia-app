#pragma once

#include "CoreMinimal.h"
#include "Machines/MachineBase.h"
#include "ExodusHub.generated.h"

class UTierProgressionSubsystem;
class UStaticMesh;

/**
 * Hub do Projeto Êxodo (ver docs/HISTORIA.md).
 *
 * Recebe itens (por esteira no InputBuffer ou depósito manual do jogador) e os
 * entrega como metas do tier atual. Cada tier completo é um módulo da nave:
 * a malha em ShipStageMeshes correspondente aparece na plataforma de lançamento.
 */
UCLASS()
class TERRAFORGE_API AExodusHub : public AMachineBase
{
	GENERATED_BODY()

public:
	AExodusHub();

	virtual void BeginPlay() override;

	/** Avança de tier automaticamente ao completar as metas. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hub")
	bool bAutoAdvanceTier = true;

	/** Depósito manual do jogador (chamado pela UI de interação). */
	UFUNCTION(BlueprintCallable, Category = "Hub")
	int32 DepositItem(UItemData* Item, int32 Count);

	/** Progresso total do Projeto Êxodo [0..1] (tiers completos / total). */
	UFUNCTION(BlueprintPure, Category = "Hub")
	float GetShipProgress() const;

protected:
	virtual bool CanProduce() const override;
	virtual void ProduceCycle() override;

	UFUNCTION()
	void HandleTierAdvanced(int32 NewTier);

	/**
	 * Peças do foguete na plataforma de lançamento e o tier em que cada uma
	 * aparece (arrays paralelos). A nave cresce fisicamente a cada fase.
	 */
	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> ShipParts;

	UPROPERTY()
	TArray<int32> ShipPartStage;

	UPROPERTY(Transient)
	TObjectPtr<UTierProgressionSubsystem> Progression;

private:
	void AddShipPart(FName PartName, UStaticMesh* PartMesh, const FVector& RelLocation,
		const FVector& RelScale, const FRotator& RelRotation, int32 Stage, bool bAccent);
	void UpdateShipVisual(int32 ProgressTier);
};
