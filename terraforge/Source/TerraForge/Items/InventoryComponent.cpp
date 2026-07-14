#include "Items/InventoryComponent.h"

int32 UInventoryComponent::GetTotalCount() const
{
	int32 Total = 0;
	for (const FItemStack& Stack : Items)
	{
		Total += Stack.Count;
	}
	return Total;
}

int32 UInventoryComponent::CountItem(const UItemData* Item) const
{
	for (const FItemStack& Stack : Items)
	{
		if (Stack.Item == Item)
		{
			return Stack.Count;
		}
	}
	return 0;
}

int32 UInventoryComponent::AddItem(UItemData* Item, int32 Count)
{
	if (!Item || Count <= 0)
	{
		return 0;
	}

	const int32 ToAdd = FMath::Min(Count, Capacity - GetTotalCount());
	if (ToAdd <= 0)
	{
		return 0;
	}

	for (FItemStack& Stack : Items)
	{
		if (Stack.Item == Item)
		{
			Stack.Count += ToAdd;
			OnInventoryChanged.Broadcast();
			return ToAdd;
		}
	}

	FItemStack NewStack;
	NewStack.Item = Item;
	NewStack.Count = ToAdd;
	Items.Add(NewStack);
	OnInventoryChanged.Broadcast();
	return ToAdd;
}

int32 UInventoryComponent::RemoveItem(UItemData* Item, int32 Count)
{
	if (!Item || Count <= 0)
	{
		return 0;
	}

	for (int32 i = 0; i < Items.Num(); ++i)
	{
		if (Items[i].Item == Item)
		{
			const int32 Removed = FMath::Min(Count, Items[i].Count);
			Items[i].Count -= Removed;
			if (Items[i].Count <= 0)
			{
				Items.RemoveAt(i);
			}
			OnInventoryChanged.Broadcast();
			return Removed;
		}
	}
	return 0;
}

bool UInventoryComponent::HasItems(const TArray<FItemStack>& Cost) const
{
	for (const FItemStack& Entry : Cost)
	{
		if (CountItem(Entry.Item) < Entry.Count)
		{
			return false;
		}
	}
	return true;
}

bool UInventoryComponent::ConsumeItems(const TArray<FItemStack>& Cost)
{
	if (!HasItems(Cost))
	{
		return false;
	}
	for (const FItemStack& Entry : Cost)
	{
		RemoveItem(Entry.Item, Entry.Count);
	}
	return true;
}
