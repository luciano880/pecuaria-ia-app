#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Items/ItemData.h"
#include "InventoryComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnInventoryChanged);

/** Inventário do jogador: paga construções e upgrades, recebe itens coletados. */
UCLASS(ClassGroup = (TerraForge), meta = (BlueprintSpawnableComponent))
class TERRAFORGE_API UInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventory")
	TArray<FItemStack> Items;

	/** Capacidade total em itens (soma de todas as pilhas). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventory", meta = (ClampMin = 1))
	int32 Capacity = 500;

	UPROPERTY(BlueprintAssignable, Category = "Inventory")
	FOnInventoryChanged OnInventoryChanged;

	UFUNCTION(BlueprintPure, Category = "Inventory")
	int32 GetTotalCount() const;

	UFUNCTION(BlueprintPure, Category = "Inventory")
	int32 CountItem(const UItemData* Item) const;

	/** @return quantidade realmente adicionada (limitada pela capacidade). */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	int32 AddItem(UItemData* Item, int32 Count);

	/** @return quantidade realmente removida. */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	int32 RemoveItem(UItemData* Item, int32 Count);

	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool HasItems(const TArray<FItemStack>& Cost) const;

	/** Consome o custo inteiro de forma atômica. @return false se faltar algo. */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool ConsumeItems(const TArray<FItemStack>& Cost);

	/** Acesso direto para APIs C++ que operam sobre TArray<FItemStack>&. */
	TArray<FItemStack>& GetItemsRef() { return Items; }
};
