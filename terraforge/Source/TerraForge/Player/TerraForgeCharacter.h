#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "TerraForgeCharacter.generated.h"

class UCameraComponent;
class UInventoryComponent;
class UBuildSystemComponent;
class UInputMappingContext;
class UInputAction;
class AMachineBase;
struct FInputActionValue;

/**
 * Engenheiro(a) do Projeto Êxodo — personagem em primeira pessoa.
 *
 * Controles padrão (criados por CÓDIGO se nenhum asset de Enhanced Input for
 * atribuído no Blueprint — o jogo funciona sem configurar nada no editor):
 *   WASD + mouse + Espaço, E = interagir (coletar buffers),
 *   B = escolher máquina para construir (cicla a lista Buildables),
 *   clique esq. = construir, Q = cancelar, R = girar preview.
 */
UCLASS()
class TERRAFORGE_API ATerraForgeCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ATerraForgeCharacter();

	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	UFUNCTION(BlueprintPure, Category = "Player")
	UInventoryComponent* GetInventory() const { return Inventory; }

	UFUNCTION(BlueprintPure, Category = "Player")
	UBuildSystemComponent* GetBuildSystem() const { return BuildSystem; }

protected:
	virtual void BeginPlay() override;

	// --- Componentes ---

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Player")
	TObjectPtr<UCameraComponent> Camera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Player")
	TObjectPtr<UInventoryComponent> Inventory;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Player")
	TObjectPtr<UBuildSystemComponent> BuildSystem;

	// --- Enhanced Input (assets atribuídos no Blueprint filho) ---

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> JumpAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> InteractAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> BuildConfirmAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> BuildCancelAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> BuildRotateAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> BuildMenuAction;

	/** Alcance da interação (coletar de máquinas, upgrade), em uu. */
	UPROPERTY(EditDefaultsOnly, Category = "Player", meta = (ClampMin = 100))
	float InteractRange = 600.0f;

	/** Máquinas disponíveis na tecla B (padrão preenchido em C++). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Player")
	TArray<TSubclassOf<AMachineBase>> Buildables;

	// --- Handlers ---

	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void Interact();
	void ConfirmBuild();
	void CancelBuild();
	void RotateBuildPreview();
	void CycleBuildable();

private:
	/** Cria mapping context + actions por código quando não há assets. */
	void EnsureRuntimeInput();

	int32 BuildableIndex = -1;
};
