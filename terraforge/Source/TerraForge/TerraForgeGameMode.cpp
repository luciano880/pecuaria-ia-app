#include "TerraForgeGameMode.h"
#include "Player/TerraForgeCharacter.h"

ATerraForgeGameMode::ATerraForgeGameMode()
{
	// O Blueprint filho (BP_TerraForgeGameMode) pode trocar pelo BP_Character
	// com os assets de input e malhas configurados.
	DefaultPawnClass = ATerraForgeCharacter::StaticClass();
}
