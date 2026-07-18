#include "World/DayNightCycle.h"
#include "Engine/DirectionalLight.h"
#include "Components/LightComponent.h"
#include "EngineUtils.h"

ADayNightCycle::ADayNightCycle()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ADayNightCycle::BeginPlay()
{
	Super::BeginPlay();
	TimeOfDay = StartTimeOfDay;
	FindSun();
}

void ADayNightCycle::FindSun()
{
	// Usa o sol mais forte do mapa (o de preenchimento tem intensidade baixa).
	float BestIntensity = -1.0f;
	for (TActorIterator<ADirectionalLight> It(GetWorld()); It; ++It)
	{
		ULightComponent* Light = It->GetLightComponent();
		if (Light && Light->Intensity > BestIntensity)
		{
			BestIntensity = Light->Intensity;
			Sun = *It;
		}
	}

	if (Sun && Sun->GetLightComponent())
	{
		Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);
	}
}

void ADayNightCycle::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!Sun)
	{
		return;
	}

	TimeOfDay = FMath::Fmod(TimeOfDay + DeltaSeconds / DayLengthSeconds, 1.0f);

	// 0.0 = meia-noite, 0.25 = nascer, 0.5 = meio-dia, 0.75 = pôr do sol.
	const float SunAngle = TimeOfDay * 360.0f - 90.0f;
	Sun->SetActorRotation(FRotator(-SunAngle, 35.0f, 0.0f));

	// Elevação do sol [-1..1]; intensidade e cor acompanham.
	const float Elevation = FMath::Sin(FMath::DegreesToRadians(SunAngle));
	const float DayFactor = FMath::Clamp(Elevation, 0.0f, 1.0f);

	if (ULightComponent* Light = Sun->GetLightComponent())
	{
		Light->SetIntensity(FMath::Lerp(NightIntensity, NoonIntensity, DayFactor));

		// Entardecer/amanhecer alaranjado; noite azulada.
		FLinearColor Color = FLinearColor::White;
		if (DayFactor < 0.25f && Elevation > -0.1f)
		{
			Color = FLinearColor(1.0f, 0.55f, 0.3f); // dourado do horizonte
		}
		else if (Elevation <= -0.1f)
		{
			Color = FLinearColor(0.55f, 0.65f, 1.0f); // luar azulado
		}
		Light->SetLightColor(Color);
	}
}
