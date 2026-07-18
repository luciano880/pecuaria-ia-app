#pragma once

#include "CoreMinimal.h"

class UMeshComponent;

namespace TerraForgeTint
{
	/**
	 * Pinta um componente de malha com cor sólida, criando um material dinâmico
	 * a partir do BasicShapeMaterial do engine (que tem o parâmetro "Color").
	 * Necessário porque, na UE 5.6, as malhas básicas podem vir com o material
	 * grid padrão, que ignora parâmetros de cor.
	 */
	TERRAFORGE_API void Tint(UMeshComponent* Component, const FLinearColor& Color);
}
