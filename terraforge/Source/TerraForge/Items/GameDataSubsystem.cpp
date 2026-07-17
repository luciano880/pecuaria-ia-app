#include "Items/GameDataSubsystem.h"
#include "Items/ItemData.h"
#include "Progression/TierProgressionSubsystem.h"
#include "TerraForge.h"

void UGameDataSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	CreateItem("MinerioFerro", TEXT("Minério de Ferro"), true);
	CreateItem("LingoteFerro", TEXT("Lingote de Ferro"), false);
	CreateItem("PlacaAco", TEXT("Placa de Aço"), false);
	CreateItem("Carvao", TEXT("Carvão"), true);
	CreateItem("Biomassa", TEXT("Biomassa"), false);
	CreateItem("OleoCombustivel", TEXT("Óleo Combustível"), false);
	CreateItem("BarraUranio", TEXT("Barra de Urânio"), false);
	CreateItem("RejeitolNuclear", TEXT("Rejeito Nuclear"), false);

	// Metas de tier padrão, caso nenhum Blueprint tenha configurado.
	UTierProgressionSubsystem* Progression =
		Collection.InitializeDependency<UTierProgressionSubsystem>();
	if (Progression && Progression->Tiers.Num() == 0)
	{
		FTierDefinition Tier0;
		Tier0.TierName = FText::FromString(TEXT("Instalação Inicial"));
		FTierGoal Goal0;
		Goal0.Item = GetItem("MinerioFerro");
		Goal0.Required = 50;
		Tier0.Goals.Add(Goal0);
		Progression->Tiers.Add(Tier0);

		FTierDefinition Tier1;
		Tier1.TierName = FText::FromString(TEXT("Mecanização"));
		FTierGoal Goal1;
		Goal1.Item = GetItem("LingoteFerro");
		Goal1.Required = 100;
		Tier1.Goals.Add(Goal1);
		Progression->Tiers.Add(Tier1);

		UE_LOG(LogTerraForge, Log, TEXT("GameData: metas de tier padrão configuradas"));
	}
}

UItemData* UGameDataSubsystem::GetItem(FName Id) const
{
	const TObjectPtr<UItemData>* Found = Items.Find(Id);
	return Found ? Found->Get() : nullptr;
}

UItemData* UGameDataSubsystem::CreateItem(FName Id, const FString& DisplayName, bool bRawOre)
{
	UItemData* Item = NewObject<UItemData>(this, Id);
	Item->DisplayName = FText::FromString(DisplayName);
	Item->bIsRawOre = bRawOre;
	Items.Add(Id, Item);
	return Item;
}
