#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "GameDataSubsystem.generated.h"

class UItemData;

/**
 * Registro central de itens do jogo, criado por código no boot — permite jogar
 * sem criar nenhum Data Asset no editor. IDs disponíveis:
 *   MinerioFerro, LingoteFerro, PlacaAco, Carvao, Biomassa, OleoCombustivel,
 *   BarraUranio, RejeitolNuclear
 * Também popula as metas de tier padrão se ninguém tiver configurado.
 * (Data Assets criados no editor continuam funcionando normalmente — isto é
 * apenas o fallback para o jogo funcionar de imediato.)
 */
UCLASS()
class TERRAFORGE_API UGameDataSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	UFUNCTION(BlueprintPure, Category = "GameData")
	UItemData* GetItem(FName Id) const;

private:
	UPROPERTY()
	TMap<FName, TObjectPtr<UItemData>> Items;

	UItemData* CreateItem(FName Id, const FString& DisplayName, bool bRawOre);
};
