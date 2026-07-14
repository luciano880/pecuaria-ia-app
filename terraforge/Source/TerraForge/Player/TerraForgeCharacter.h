#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "TerraForgeCharacter.generated.h"

class UCameraComponent;
class UInventoryComponent;
class UBuildSystemComponent;
class UInputMappingContext;
class UInputAction;
struct FInputActionValue;

/**
 * Engenheiro(a) do Projeto Êxodo — personagem em primeira pessoa.
 * Controles (assets de Enhanced Input configurados no Blueprint filho):
 *   WASD/olhar/pular, E = interagir (coletar/upgrade),
 *   clique = confirmar construção, Q = cancelar, R = girar preview.
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

	/** Alcance da interação (coletar de máquinas, upgrade), em uu. */
	UPROPERTY(EditDefaultsOnly, Category = "Player", meta = (ClampMin = 100))
	float InteractRange = 600.0f;

	// --- Handlers ---

	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void Interact();
	void ConfirmBuild();
	void CancelBuild();
	void RotateBuildPreview();
};
