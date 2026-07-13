#include "Progression/TierProgressionSubsystem.h"
#include "TerraForge.h"

int32 UTierProgressionSubsystem::DeliverItem(UItemData* Item, int32 Count)
{
	if (!Item || Count <= 0 || !Tiers.IsValidIndex(CurrentTier))
	{
		return 0;
	}

	for (FTierGoal& Goal : Tiers[CurrentTier].Goals)
	{
		if (Goal.Item == Item && !Goal.IsComplete())
		{
			const int32 Accepted = FMath::Min(Count, Goal.Required - Goal.Delivered);
			Goal.Delivered += Accepted;
			return Accepted;
		}
	}
	return 0;
}

bool UTierProgressionSubsystem::IsCurrentTierComplete() const
{
	if (!Tiers.IsValidIndex(CurrentTier))
	{
		return false;
	}

	for (const FTierGoal& Goal : Tiers[CurrentTier].Goals)
	{
		if (!Goal.IsComplete())
		{
			return false;
		}
	}
	return true;
}

bool UTierProgressionSubsystem::AdvanceTier()
{
	if (!IsCurrentTierComplete() || !Tiers.IsValidIndex(CurrentTier + 1))
	{
		return false;
	}

	++CurrentTier;
	OnTierAdvanced.Broadcast(CurrentTier);
	UE_LOG(LogTerraForge, Log, TEXT("Tier avançado para %d (%s)"),
		CurrentTier, *Tiers[CurrentTier].TierName.ToString());
	return true;
}
