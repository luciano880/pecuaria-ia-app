#include "Player/TerraForgeCharacter.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/LocalPlayer.h"
#include "InputActionValue.h"
#include "GameFramework/PlayerController.h"
#include "Items/InventoryComponent.h"
#include "Building/BuildSystemComponent.h"
#include "Machines/MachineBase.h"
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
}

void ATerraForgeCharacter::BeginPlay()
{
	Super::BeginPlay();

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
}

void ATerraForgeCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		return;
	}

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

	// MVP: coleta tudo do buffer de saída da máquina para o inventário.
	// (A UI de interação/upgrade substitui isso depois.)
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
