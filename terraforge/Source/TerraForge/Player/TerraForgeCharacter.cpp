#include "Player/TerraForgeCharacter.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/LocalPlayer.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "GameFramework/PlayerController.h"
#include "Items/InventoryComponent.h"
#include "Items/GameDataSubsystem.h"
#include "Building/BuildSystemComponent.h"
#include "Machines/MachineBase.h"
#include "Machines/MinerMachine.h"
#include "Machines/SmelterMachine.h"
#include "Machines/GeneratorMachine.h"
#include "TerraForge.h"

ATerraForgeCharacter::ATerraForgeCharacter()
{
	PrimaryActorTick.bCanEverTick = false;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(GetCapsuleComponent());
	Camera->SetRelativeLocation(FVector(0.0f, 0.0f, 60.0f));
	Camera->bUsePawnControlRotation = true;

	Inventory = CreateDefaultSubobject<UInventoryComponent>(TEXT("Inventory"));
	BuildSystem = CreateDefaultSubobject<UBuildSystemComponent>(TEXT("BuildSystem"));

	// Máquinas da tecla B (Blueprints podem substituir esta lista).
	Buildables = {
		AMinerMachine::StaticClass(),
		ASmelterMachine::StaticClass(),
		AGeneratorMachine::StaticClass()
	};
}

void ATerraForgeCharacter::EnsureRuntimeInput()
{
	if (DefaultMappingContext)
	{
		return; // assets do editor têm prioridade
	}

	DefaultMappingContext = NewObject<UInputMappingContext>(this);

	auto MakeAction = [this](EInputActionValueType ValueType)
	{
		UInputAction* Action = NewObject<UInputAction>(this);
		Action->ValueType = ValueType;
		return Action;
	};

	MoveAction = MakeAction(EInputActionValueType::Axis2D);
	LookAction = MakeAction(EInputActionValueType::Axis2D);
	JumpAction = MakeAction(EInputActionValueType::Boolean);
	InteractAction = MakeAction(EInputActionValueType::Boolean);
	BuildConfirmAction = MakeAction(EInputActionValueType::Boolean);
	BuildCancelAction = MakeAction(EInputActionValueType::Boolean);
	BuildRotateAction = MakeAction(EInputActionValueType::Boolean);
	BuildMenuAction = MakeAction(EInputActionValueType::Boolean);

	auto MapMoveKey = [this](const FKey& Key, bool bSwizzle, bool bNegate)
	{
		FEnhancedActionKeyMapping& Mapping = DefaultMappingContext->MapKey(MoveAction, Key);
		if (bSwizzle)
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierSwizzleAxis>(this)); // YXZ
		}
		if (bNegate)
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierNegate>(this));
		}
	};

	MapMoveKey(EKeys::W, true, false);
	MapMoveKey(EKeys::S, true, true);
	MapMoveKey(EKeys::D, false, false);
	MapMoveKey(EKeys::A, false, true);

	{
		FEnhancedActionKeyMapping& Mapping =
			DefaultMappingContext->MapKey(LookAction, EKeys::Mouse2D);
		UInputModifierNegate* NegateY = NewObject<UInputModifierNegate>(this);
		NegateY->bX = false;
		NegateY->bY = true;
		NegateY->bZ = false;
		Mapping.Modifiers.Add(NegateY);
	}

	DefaultMappingContext->MapKey(JumpAction, EKeys::SpaceBar);
	DefaultMappingContext->MapKey(InteractAction, EKeys::E);
	DefaultMappingContext->MapKey(BuildConfirmAction, EKeys::LeftMouseButton);
	DefaultMappingContext->MapKey(BuildCancelAction, EKeys::Q);
	DefaultMappingContext->MapKey(BuildRotateAction, EKeys::R);
	DefaultMappingContext->MapKey(BuildMenuAction, EKeys::B);

	UE_LOG(LogTerraForge, Log, TEXT("Input padrão criado por código (sem assets)"));
}

void ATerraForgeCharacter::BeginPlay()
{
	Super::BeginPlay();

	EnsureRuntimeInput();

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			if (DefaultMappingContext)
			{
				Subsystem->AddMappingContext(DefaultMappingContext, 0);
			}
		}
	}

	// Kit inicial do engenheiro: biomassa para reabastecer a usina.
	if (const UGameInstance* GameInstance = GetGameInstance())
	{
		if (UGameDataSubsystem* Data = GameInstance->GetSubsystem<UGameDataSubsystem>())
		{
			Inventory->AddItem(Data->GetItem("Biomassa"), 50);
		}
	}
}

void ATerraForgeCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		return;
	}

	// Garante que as actions existem mesmo se este método rodar antes do BeginPlay.
	EnsureRuntimeInput();

	if (MoveAction)
	{
		Input->BindAction(MoveAction, ETriggerEvent::Triggered, this, &ATerraForgeCharacter::Move);
	}
	if (LookAction)
	{
		Input->BindAction(LookAction, ETriggerEvent::Triggered, this, &ATerraForgeCharacter::Look);
	}
	if (JumpAction)
	{
		Input->BindAction(JumpAction, ETriggerEvent::Started, this, &ACharacter::Jump);
		Input->BindAction(JumpAction, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
	}
	if (InteractAction)
	{
		Input->BindAction(InteractAction, ETriggerEvent::Started, this,
			&ATerraForgeCharacter::Interact);
	}
	if (BuildConfirmAction)
	{
		Input->BindAction(BuildConfirmAction, ETriggerEvent::Started, this,
			&ATerraForgeCharacter::ConfirmBuild);
	}
	if (BuildCancelAction)
	{
		Input->BindAction(BuildCancelAction, ETriggerEvent::Started, this,
			&ATerraForgeCharacter::CancelBuild);
	}
	if (BuildRotateAction)
	{
		Input->BindAction(BuildRotateAction, ETriggerEvent::Started, this,
			&ATerraForgeCharacter::RotateBuildPreview);
	}
	if (BuildMenuAction)
	{
		Input->BindAction(BuildMenuAction, ETriggerEvent::Started, this,
			&ATerraForgeCharacter::CycleBuildable);
	}
}

void ATerraForgeCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
	if (Controller)
	{
		const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
		AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Axis.Y);
		AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Axis.X);
	}
}

void ATerraForgeCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
	AddControllerYawInput(Axis.X);
	AddControllerPitchInput(Axis.Y);
}

void ATerraForgeCharacter::Interact()
{
	FVector ViewLocation;
	FRotator ViewRotation;
	GetActorEyesViewPoint(ViewLocation, ViewRotation);

	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.AddIgnoredActor(this);
	GetWorld()->LineTraceSingleByChannel(Hit, ViewLocation,
		ViewLocation + ViewRotation.Vector() * InteractRange, ECC_Visibility, Params);

	AMachineBase* Machine = Cast<AMachineBase>(Hit.GetActor());
	if (!Machine)
	{
		return;
	}

	// Geradores: reabastece com o combustível do inventário (até 20 por vez).
	if (AGeneratorMachine* Generator = Cast<AGeneratorMachine>(Machine))
	{
		if (Generator->FuelItem && Inventory->CountItem(Generator->FuelItem) > 0)
		{
			const int32 ToLoad = FMath::Min(20, Inventory->CountItem(Generator->FuelItem));
			const int32 Loaded =
				Generator->AddToBuffer(Generator->InputBuffer, Generator->FuelItem, ToLoad);
			Inventory->RemoveItem(Generator->FuelItem, Loaded);
			UE_LOG(LogTerraForge, Log, TEXT("Reabasteceu %s com %d combustível"),
				*Generator->GetName(), Loaded);
			return;
		}
	}

	// Demais máquinas: coleta o buffer de saída para o inventário.
	while (Machine->OutputBuffer.Num() > 0)
	{
		FItemStack Stack = Machine->OutputBuffer[0];
		const int32 Taken = Inventory->AddItem(Stack.Item, Stack.Count);
		if (Taken <= 0)
		{
			break; // inventário cheio
		}
		Machine->RemoveFromBuffer(Machine->OutputBuffer, Stack.Item, Taken);
	}

	UE_LOG(LogTerraForge, Log, TEXT("Interagiu com %s"), *Machine->GetName());
}

void ATerraForgeCharacter::ConfirmBuild()
{
	if (BuildSystem->IsPlacing())
	{
		BuildSystem->ConfirmPlacement(Inventory);
	}
}

void ATerraForgeCharacter::CancelBuild()
{
	BuildSystem->CancelPlacement();
}

void ATerraForgeCharacter::RotateBuildPreview()
{
	BuildSystem->RotatePreview();
}

void ATerraForgeCharacter::CycleBuildable()
{
	if (Buildables.Num() == 0)
	{
		return;
	}

	BuildableIndex = (BuildableIndex + 1) % Buildables.Num();
	if (Buildables[BuildableIndex])
	{
		BuildSystem->StartPlacement(Buildables[BuildableIndex]);
		UE_LOG(LogTerraForge, Log, TEXT("Modo construção: %s"),
			*Buildables[BuildableIndex]->GetName());
	}
}
