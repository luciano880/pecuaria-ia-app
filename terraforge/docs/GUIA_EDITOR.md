# TerraForge — Guia de Setup no Editor UE5

Passo-a-passo para sair do código C++ e chegar no **primeiro teste jogável**:
minerar → fundir → entregar no Hub. Tempo estimado: 1–2 horas.

> **Importante:** NÃO crie um projeto novo do template First Person.
> Abra direto o `TerraForge.uproject` — o personagem em primeira pessoa
> já existe no código (`ATerraForgeCharacter`).

## 1. Compilar e abrir

1. Instale **UE 5.4+** e **Visual Studio 2022** (workload "Game development with C++").
2. Botão direito em `TerraForge.uproject` → **Generate Visual Studio project files**.
3. Abra `TerraForge.sln`, selecione **Development Editor | Win64**, compile (Ctrl+Shift+B).
4. Abra o `TerraForge.uproject`. Se pedir para recompilar módulos, aceite.
5. Crie a pasta `Content/Maps` e um level novo (Basic) chamado **L_Cerrado**
   (é o mapa padrão configurado em `Config/DefaultEngine.ini`). Salve.

## 2. Enhanced Input (Content/Input/)

Crie os assets (botão direito → Input):

| Asset | Tipo | Value Type |
|---|---|---|
| `IA_Move` | Input Action | Axis2D (Vector2D) |
| `IA_Look` | Input Action | Axis2D (Vector2D) |
| `IA_Jump` | Input Action | Digital (bool) |
| `IA_Interact` | Input Action | Digital |
| `IA_BuildConfirm` | Input Action | Digital |
| `IA_BuildCancel` | Input Action | Digital |
| `IA_BuildRotate` | Input Action | Digital |
| `IMC_Default` | Input Mapping Context | — |

No `IMC_Default`, mapeie:
- `IA_Move`: **W** (Swizzle YXZ), **S** (Swizzle YXZ + Negate), **D**, **A** (Negate)
- `IA_Look`: **Mouse XY 2D-Axis** (Negate no Y)
- `IA_Jump`: **Espaço** | `IA_Interact`: **E** | `IA_BuildConfirm`: **Botão esq. do mouse**
- `IA_BuildCancel`: **Q** | `IA_BuildRotate`: **R**

## 3. Personagem e GameMode (Content/Player/)

1. Blueprint **BP_Character** herdando de `ATerraForgeCharacter`.
   - Em *Input*: preencha `Default Mapping Context = IMC_Default` e todas as Input Actions.
2. Blueprint **BP_GameMode** herdando de `ATerraForgeGameMode`.
   - `Default Pawn Class = BP_Character`.
3. No **World Settings** do L_Cerrado: `GameMode Override = BP_GameMode`.
4. Arraste um **Player Start** para o mapa.

Teste (Play): andar/olhar/pular já devem funcionar.

## 4. Materiais de preview (Content/Building/)

1. `M_BuildValid`: material **Translucent**, Base Color verde, Opacity 0.4.
2. `M_BuildInvalid`: igual, vermelho.
3. No BP_Character → componente **BuildSystem**: atribua os dois materiais.

## 5. Itens (Content/Items/) — Data Assets de `UItemData`

Botão direito → Miscellaneous → Data Asset → `ItemData`:

`DA_MinerioFerro` (bIsRawOre ✔), `DA_LingoteFerro`, `DA_Carvao` (bIsRawOre ✔),
`DA_Biomassa`, `DA_PlacaAco`. Preencha só o DisplayName por enquanto.

## 6. Máquinas (Content/Machines/) — Blueprints

Use malhas placeholder do engine (Cube/Cylinder) redimensionadas no componente Mesh.

| Blueprint | Classe pai | Configurar |
|---|---|---|
| `BP_NoFerro` | `AResourceNode` | `OreType = DA_MinerioFerro`, mesh esfera achatada |
| `BP_NoCarvao` | `AResourceNode` | `OreType = DA_Carvao` |
| `BP_Geiser` | `AResourceNode` | `bIsGeyser ✔`, sem OreType |
| `BP_Miner` | `AMinerMachine` | TierSpecs[0]: CycleTime 2.0, ItemsPerCycle 1, Power 5 MW, Pollution 1/min. BuildCost: 10x DA_LingoteFerro (deixe vazio no primeiro teste) |
| `BP_Fundicao` | `ASmelterMachine` | ActiveRecipe: 1x DA_MinerioFerro → 1x DA_LingoteFerro. CycleTime 3.0, Power 8 MW |
| `BP_UsinaBiomassa` | `AGeneratorMachine` | `FuelItem = DA_Biomassa`, `PowerOutputMW = 20`, `SecondsPerFuelUnit = 8`, Pollution 2/min |
| `BP_Esteira` | `AConveyorBelt` | Edite os pontos do **Spline** no mapa ligando origem→destino |
| `BP_Hub` | `AExodusHub` | Ver passo 7 |

## 7. Metas de tier (no BP_Hub)

O `UTierProgressionSubsystem` começa vazio; popule no **BeginPlay do BP_Hub**:

1. `Get Game Instance → Get Subsystem (TierProgressionSubsystem)`.
2. `Set Tiers` com um array:
   - Tier 0 "Instalação Inicial": Goal { Item = DA_MinerioFerro, Required = 50 }
   - Tier 1 "Mecanização": Goal { Item = DA_LingoteFerro, Required = 100 }
3. (Depois chame o `Parent: BeginPlay` — mantenha o nó pai ligado.)

## 8. Montar o mapa e testar o loop

1. Coloque no L_Cerrado: 2x `BP_NoFerro`, 1x `BP_NoCarvao`, `BP_Hub`, Player Start.
2. Coloque um `BP_Miner` **em cima** de um nó de ferro (ele acha o nó em até 4 m).
3. Coloque uma `BP_Fundicao` ao lado e um `BP_Esteira`:
   - Selecione a esteira → Details: `SourceMachine = BP_Miner`, `TargetMachine = BP_Fundicao`.
   - Outra esteira: `SourceMachine = BP_Fundicao`, `TargetMachine = BP_Hub`.
4. **Play**: o minério deve fluir sozinho e o Output Log mostrar
   `LogTerraForge: Tier avançado para 1` quando as 50 unidades chegarem.
5. Interaja (**E**) com uma máquina para coletar o buffer dela para o inventário.

## 9. Energia (segundo teste)

1. Coloque uma `BP_UsinaBiomassa` e, via Details do ator, adicione `DA_Biomassa`
   no InputBuffer dela (ou deposite com uma esteira).
2. Com Power > 0 nas máquinas, sem usina ligada elas param (brownout total).
3. Console (`~`): não há comando pronto ainda — acompanhe pelo Output Log.

## Problemas comuns

- **Máquina não produz**: veja se `TierSpecs[0]` tem CycleTime > 0 e, se Power > 0,
  se há usina ligada com combustível.
- **Esteira não move**: confira Source/Target no Details e se o spline tem comprimento.
- **Preview não aparece**: o BP da máquina precisa ter uma malha no componente Mesh
  (o preview copia a malha do Blueprint).
- **Logs**: Window → Output Log, filtre por `LogTerraForge`.
