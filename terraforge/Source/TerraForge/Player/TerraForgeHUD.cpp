#include "Player/TerraForgeHUD.h"
#include "Player/TerraForgeCharacter.h"
#include "Items/InventoryComponent.h"
#include "Items/ItemData.h"
#include "Building/BuildSystemComponent.h"
#include "Machines/MachineBase.h"
#include "Machines/GeneratorMachine.h"
#include "Power/PowerGridSubsystem.h"
#include "Environment/EnvironmentSubsystem.h"
#include "Progression/TierProgressionSubsystem.h"
#include "Engine/Canvas.h"
#include "CanvasItem.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"

namespace
{
	const FLinearColor PanelColor(0.02f, 0.02f, 0.04f, 0.62f);
	const FLinearColor GoodColor(0.3f, 0.9f, 0.35f);
	const FLinearColor BadColor(0.95f, 0.3f, 0.2f);
	const FLinearColor TitleColor(0.95f, 0.8f, 0.3f);
}

void ATerraForgeHUD::DrawHUD()
{
	Super::DrawHUD();

	if (!Canvas)
	{
		return;
	}

	DrawCrosshair();
	DrawTierPanel();
	DrawPowerAndEnvironment();
	DrawInventory();
	DrawBuildHints();
	DrawMachineUnderCrosshair();
}

void ATerraForgeHUD::Panel(float X, float Y, float W, float H) const
{
	FCanvasTileItem Tile(FVector2D(X, Y), FVector2D(W, H), PanelColor);
	Tile.BlendMode = SE_BLEND_Translucent;
	Canvas->DrawItem(Tile);
}

void ATerraForgeHUD::Bar(float X, float Y, float W, float H, float Pct,
	const FLinearColor& Color) const
{
	FCanvasTileItem Back(FVector2D(X, Y), FVector2D(W, H),
		FLinearColor(0.1f, 0.1f, 0.12f, 0.8f));
	Back.BlendMode = SE_BLEND_Translucent;
	Canvas->DrawItem(Back);

	FCanvasTileItem Front(FVector2D(X, Y),
		FVector2D(W * FMath::Clamp(Pct, 0.0f, 1.0f), H), Color);
	Front.BlendMode = SE_BLEND_Translucent;
	Canvas->DrawItem(Front);
}

void ATerraForgeHUD::Line(const FString& Text, float X, float Y,
	const FLinearColor& Color, float Scale) const
{
	FCanvasTextItem Item(FVector2D(X, Y), FText::FromString(Text),
		GEngine->GetMediumFont(), Color);
	Item.Scale = FVector2D(Scale, Scale);
	Item.EnableShadow(FLinearColor::Black);
	Canvas->DrawItem(Item);
}

void ATerraForgeHUD::DrawCrosshair()
{
	const float CX = Canvas->ClipX * 0.5f;
	const float CY = Canvas->ClipY * 0.5f;
	const FLinearColor Color(1, 1, 1, 0.8f);

	FCanvasTileItem H(FVector2D(CX - 7, CY - 1), FVector2D(14, 2), Color);
	H.BlendMode = SE_BLEND_Translucent;
	Canvas->DrawItem(H);
	FCanvasTileItem V(FVector2D(CX - 1, CY - 7), FVector2D(2, 14), Color);
	V.BlendMode = SE_BLEND_Translucent;
	Canvas->DrawItem(V);
}

void ATerraForgeHUD::DrawTierPanel()
{
	const UGameInstance* GameInstance = GetGameInstance();
	UTierProgressionSubsystem* Progression =
		GameInstance ? GameInstance->GetSubsystem<UTierProgressionSubsystem>() : nullptr;
	if (!Progression || !Progression->Tiers.IsValidIndex(Progression->CurrentTier))
	{
		return;
	}

	const FTierDefinition& Tier = Progression->Tiers[Progression->CurrentTier];
	const float X = 20.0f;
	float Y = 20.0f;
	const float W = 320.0f;
	const float H = 46.0f + Tier.Goals.Num() * 40.0f;

	Panel(X - 8, Y - 8, W, H);
	Line(FString::Printf(TEXT("PROJETO ÊXODO — TIER %d: %s"),
		Progression->CurrentTier, *Tier.TierName.ToString()), X, Y, TitleColor, 1.1f);
	Y += 34.0f;

	for (const FTierGoal& Goal : Tier.Goals)
	{
		const FString ItemName = Goal.Item ? Goal.Item->DisplayName.ToString() : TEXT("?");
		Line(FString::Printf(TEXT("%s: %d / %d"), *ItemName, Goal.Delivered, Goal.Required),
			X, Y);
		Bar(X, Y + 20.0f, W - 20.0f, 8.0f,
			Goal.Required > 0 ? Goal.Delivered / float(Goal.Required) : 0.0f,
			Goal.IsComplete() ? GoodColor : TitleColor);
		Y += 40.0f;
	}
}

void ATerraForgeHUD::DrawPowerAndEnvironment()
{
	const float W = 300.0f;
	const float X = Canvas->ClipX - W - 20.0f;
	float Y = 20.0f;

	Panel(X - 8, Y - 8, W + 16, 118.0f);

	// Energia.
	if (const UPowerGridSubsystem* Grid = GetWorld()->GetSubsystem<UPowerGridSubsystem>())
	{
		const float Production = Grid->GetTotalProductionMW();
		const float Demand = Grid->GetTotalDemandMW();
		const bool bOk = Production >= Demand;
		Line(FString::Printf(TEXT("ENERGIA: %.0f / %.0f MW"), Production, Demand),
			X, Y, bOk ? GoodColor : BadColor, 1.05f);
		Bar(X, Y + 22.0f, W - 10.0f, 8.0f,
			Demand > 0.0f ? FMath::Min(Production / Demand, 1.0f) : 1.0f,
			bOk ? GoodColor : BadColor);
		if (!bOk)
		{
			Line(FString::Printf(TEXT("BROWNOUT: fábrica a %.0f%%"),
				Grid->GetGridEfficiency() * 100.0f), X, Y + 34.0f, BadColor, 0.9f);
		}
		Y += 56.0f;
	}

	// Índice ambiental.
	if (const UEnvironmentSubsystem* Env = GetWorld()->GetSubsystem<UEnvironmentSubsystem>())
	{
		const float Index = Env->GetEnvironmentalIndex();
		const FLinearColor Color = Index >= 80.0f ? GoodColor
			: Index >= 50.0f ? TitleColor : BadColor;
		Line(FString::Printf(TEXT("PLANETA: %.0f / 100"), Index), X, Y, Color, 1.05f);
		Bar(X, Y + 22.0f, W - 10.0f, 8.0f, Index / 100.0f, Color);
	}
}

void ATerraForgeHUD::DrawInventory()
{
	const ATerraForgeCharacter* Character = Cast<ATerraForgeCharacter>(GetOwningPawn());
	if (!Character || !Character->GetInventory())
	{
		return;
	}

	const TArray<FItemStack>& Items = Character->GetInventory()->Items;
	const float X = 20.0f;
	const int32 MaxLines = 6;
	const int32 Shown = FMath::Min(Items.Num(), MaxLines);
	float Y = Canvas->ClipY - 60.0f - Shown * 24.0f;

	Panel(X - 8, Y - 30, 280.0f, 46.0f + Shown * 24.0f);
	Line(TEXT("INVENTÁRIO  (E coleta da máquina na mira)"), X, Y - 22, TitleColor, 0.9f);

	if (Items.Num() == 0)
	{
		Line(TEXT("- vazio -"), X, Y + 2, FLinearColor(0.7f, 0.7f, 0.7f), 0.9f);
		return;
	}

	for (int32 i = 0; i < Shown; ++i)
	{
		const FString ItemName =
			Items[i].Item ? Items[i].Item->DisplayName.ToString() : TEXT("?");
		Line(FString::Printf(TEXT("%s x%d"), *ItemName, Items[i].Count), X, Y);
		Y += 24.0f;
	}
	if (Items.Num() > MaxLines)
	{
		Line(FString::Printf(TEXT("... +%d itens"), Items.Num() - MaxLines), X, Y,
			FLinearColor(0.7f, 0.7f, 0.7f), 0.85f);
	}
}

void ATerraForgeHUD::DrawBuildHints()
{
	const ATerraForgeCharacter* Character = Cast<ATerraForgeCharacter>(GetOwningPawn());
	const UBuildSystemComponent* Build = Character ? Character->GetBuildSystem() : nullptr;

	const float W = 430.0f;
	const float X = Canvas->ClipX - W - 20.0f;
	const float Y = Canvas->ClipY - 56.0f;

	Panel(X - 8, Y - 8, W + 16, 48.0f);

	if (Build && Build->IsPlacing())
	{
		const FLinearColor Color = Build->IsPlacementValid() ? GoodColor : BadColor;
		Line(FString::Printf(TEXT("CONSTRUINDO: %s"), *Build->GetPendingMachineName()),
			X, Y, Color, 1.0f);
		Line(TEXT("Clique constrói · R gira · Q cancela · B troca a máquina"),
			X, Y + 22.0f, FLinearColor(0.85f, 0.85f, 0.85f), 0.85f);
	}
	else
	{
		Line(TEXT("B: construir máquinas"), X, Y, FLinearColor(0.85f, 0.85f, 0.85f), 1.0f);
		Line(TEXT("WASD move · E interage · Espaço pula"),
			X, Y + 22.0f, FLinearColor(0.7f, 0.7f, 0.7f), 0.85f);
	}
}

AMachineBase* ATerraForgeHUD::GetMachineUnderCrosshair() const
{
	if (!PlayerOwner)
	{
		return nullptr;
	}

	FVector ViewLocation;
	FRotator ViewRotation;
	PlayerOwner->GetPlayerViewPoint(ViewLocation, ViewRotation);

	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.AddIgnoredActor(GetOwningPawn());
	GetWorld()->LineTraceSingleByChannel(Hit, ViewLocation,
		ViewLocation + ViewRotation.Vector() * 800.0f, ECC_Visibility, Params);

	return Cast<AMachineBase>(Hit.GetActor());
}

void ATerraForgeHUD::DrawMachineUnderCrosshair()
{
	AMachineBase* Machine = GetMachineUnderCrosshair();
	if (!Machine)
	{
		return;
	}

	const float CX = Canvas->ClipX * 0.5f;
	float Y = Canvas->ClipY * 0.5f + 40.0f;

	Line(FString::Printf(TEXT("%s Mk%d"),
		*Machine->MachineName.ToString(), Machine->CurrentTier + 1),
		CX - 90.0f, Y, TitleColor, 1.05f);
	Y += 24.0f;

	// Conteúdo do buffer de saída (o que o E coleta).
	for (const FItemStack& Stack : Machine->OutputBuffer)
	{
		if (Stack.IsValid())
		{
			Line(FString::Printf(TEXT("Saída: %s x%d"),
				*Stack.Item->DisplayName.ToString(), Stack.Count), CX - 90.0f, Y);
			Y += 22.0f;
		}
	}

	if (const AGeneratorMachine* Generator = Cast<AGeneratorMachine>(Machine))
	{
		Line(Generator->IsOnline()
			? TEXT("Gerando energia") : TEXT("SEM COMBUSTÍVEL (E reabastece)"),
			CX - 90.0f, Y, Generator->IsOnline() ? GoodColor : BadColor, 0.95f);
	}
}
