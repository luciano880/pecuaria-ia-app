#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "TerraForgeHUD.generated.h"

class AMachineBase;

/**
 * HUD desenhado por código (Canvas), sem assets:
 * metas do tier, energia, índice ambiental, inventário, info da máquina
 * na mira e dicas do modo construção.
 */
UCLASS()
class TERRAFORGE_API ATerraForgeHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

private:
	void DrawCrosshair();
	void DrawTierPanel();
	void DrawPowerAndEnvironment();
	void DrawInventory();
	void DrawBuildHints();
	void DrawMachineUnderCrosshair();

	AMachineBase* GetMachineUnderCrosshair() const;

	// Helpers de desenho.
	void Panel(float X, float Y, float W, float H) const;
	void Bar(float X, float Y, float W, float H, float Pct, const FLinearColor& Color) const;
	void Line(const FString& Text, float X, float Y,
		const FLinearColor& Color = FLinearColor::White, float Scale = 1.0f) const;
};
