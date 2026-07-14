#include "Machines/MachineBase.h"
#include "Components/StaticMeshComponent.h"
#include "Power/PowerGridSubsystem.h"
#include "Environment/EnvironmentSubsystem.h"
#include "TerraForge.h"

AMachineBase::AMachineBase()
{
	PrimaryActorTick.bCanEverTick = true;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	SetRootComponent(Mesh);

	// Spec padrão para a máquina não iniciar sem dados.
	TierSpecs.Add(FMachineTierSpec());
}

void AMachineBase::BeginPlay()
{
	Super::BeginPlay();

	if (UPowerGridSubsystem* Grid = GetWorld()->GetSubsystem<UPowerGridSubsystem>())
	{
		Grid->RegisterConsumer(this);
	}

	EnvSubsystem = GetWorld()->GetSubsystem<UEnvironmentSubsystem>();
}

void AMachineBase::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UWorld* World = GetWorld())
	{
		if (UPowerGridSubsystem* Grid = World->GetSubsystem<UPowerGridSubsystem>())
		{
			Grid->UnregisterConsumer(this);
		}
	}

	Super::EndPlay(EndPlayReason);
}

void AMachineBase::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!CanProduce() || GridEfficiency <= 0.0f)
	{
		return;
	}

	const FMachineTierSpec& Spec = GetCurrentSpec();

	// Poluição ambiental gerada + penalidade quando o índice do planeta está baixo.
	float EnvMultiplier = 1.0f;
	if (EnvSubsystem)
	{
		if (Spec.PollutionPerMinute > 0.0f)
		{
			EnvSubsystem->AddPollution(Spec.PollutionPerMinute * DeltaSeconds / 60.0f);
		}
		EnvMultiplier = EnvSubsystem->GetMachineEfficiencyMultiplier();
	}

	CycleProgress += DeltaSeconds * GridEfficiency * EnvMultiplier;

	while (CycleProgress >= Spec.CycleTime)
	{
		CycleProgress -= Spec.CycleTime;
		ProduceCycle();

		if (!CanProduce())
		{
			CycleProgress = 0.0f;
			break;
		}
	}
}

const FMachineTierSpec& AMachineBase::GetCurrentSpec() const
{
	static const FMachineTierSpec DefaultSpec;
	return TierSpecs.IsValidIndex(CurrentTier) ? TierSpecs[CurrentTier] : DefaultSpec;
}

bool AMachineBase::TryUpgrade(TArray<FItemStack>& PayerInventory)
{
	if (!CanUpgrade())
	{
		return false;
	}

	const FMachineTierSpec& NextSpec = TierSpecs[CurrentTier + 1];

	// Verifica se o pagador tem todos os itens do custo.
	for (const FItemStack& Cost : NextSpec.UpgradeCost)
	{
		if (CountInBuffer(PayerInventory, Cost.Item) < Cost.Count)
		{
			return false;
		}
	}

	// Consome o custo.
	for (const FItemStack& Cost : NextSpec.UpgradeCost)
	{
		RemoveFromBuffer(PayerInventory, Cost.Item, Cost.Count);
	}

	++CurrentTier;
	OnMachineUpgraded.Broadcast(CurrentTier);

	UE_LOG(LogTerraForge, Log, TEXT("%s upgraded to Mk%d"), *GetName(), CurrentTier + 1);
	return true;
}

int32 AMachineBase::AddToBuffer(TArray<FItemStack>& Buffer, UItemData* Item, int32 Count)
{
	if (!Item || Count <= 0)
	{
		return 0;
	}

	int32 Total = 0;
	for (const FItemStack& Stack : Buffer)
	{
		Total += Stack.Count;
	}

	const int32 ToAdd = FMath::Min(Count, BufferCapacity - Total);
	if (ToAdd <= 0)
	{
		return 0;
	}

	for (FItemStack& Stack : Buffer)
	{
		if (Stack.Item == Item)
		{
			Stack.Count += ToAdd;
			return ToAdd;
		}
	}

	FItemStack NewStack;
	NewStack.Item = Item;
	NewStack.Count = ToAdd;
	Buffer.Add(NewStack);
	return ToAdd;
}

int32 AMachineBase::RemoveFromBuffer(TArray<FItemStack>& Buffer, UItemData* Item, int32 Count)
{
	if (!Item || Count <= 0)
	{
		return 0;
	}

	for (int32 i = 0; i < Buffer.Num(); ++i)
	{
		if (Buffer[i].Item == Item)
		{
			const int32 Removed = FMath::Min(Count, Buffer[i].Count);
			Buffer[i].Count -= Removed;
			if (Buffer[i].Count <= 0)
			{
				Buffer.RemoveAt(i);
			}
			return Removed;
		}
	}
	return 0;
}

int32 AMachineBase::CountInBuffer(const TArray<FItemStack>& Buffer, const UItemData* Item) const
{
	for (const FItemStack& Stack : Buffer)
	{
		if (Stack.Item == Item)
		{
			return Stack.Count;
		}
	}
	return 0;
}
