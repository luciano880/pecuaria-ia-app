# TerraForge — Simulador de Mineração na Terra (UE5)

Jogo de simulação/automação estilo **Satisfactory**, ambientado no **planeta Terra**
com estética industrial **moderna/atual**. Você começa com uma mineradora portátil e
evolui por **fases tecnológicas** até operar complexos industriais inteiros:
alto-fornos, aciarias, refinarias de petróleo, plantas químicas e uma matriz elétrica
completa — **biomassa, carvão, petróleo e nuclear** como fontes principais, com
**geotérmica (gêiseres), solar e eólica** como opcionais.

## Requisitos

- **Unreal Engine 5.4+** (recomendado 5.4 ou 5.5)
- Visual Studio 2022 (Windows) ou Xcode (macOS) com toolchain C++ para UE5

## Como abrir o projeto

1. Clone o repositório e entre na pasta `terraforge/`.
2. Clique com o botão direito em `TerraForge.uproject` → **Generate Visual Studio project files**.
3. Abra a solution gerada e compile no modo **Development Editor**.
4. Abra o `TerraForge.uproject` no editor da UE5.

> O projeto é C++-first: as classes base ficam em `Source/TerraForge/` e devem ser
> estendidas por Blueprints no editor (ex.: `BP_Miner_Mk1` herdando de `AMinerMachine`).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `docs/GDD.md` | Documento de design completo (fases, máquinas, recursos, economia) |
| `Source/TerraForge/Items` | Definições de itens/recursos (Data Assets) |
| `Source/TerraForge/Resources` | Nós de recurso no mundo (jazidas de minério) |
| `Source/TerraForge/Machines` | Máquinas: base comum, mineradora, fundição, refinaria multi-processo, geradores a combustível e renováveis |
| `Source/TerraForge/Logistics` | Esteiras transportadoras |
| `Source/TerraForge/Power` | Rede elétrica (subsystem de mundo) |
| `Source/TerraForge/Progression` | Progressão de fases/tiers tecnológicos |
| `Config/` | Configuração do projeto (GameMode padrão, mapas, etc.) |

## Roadmap resumido

- [x] Esqueleto C++: máquinas, recursos, esteiras, energia, tiers
- [ ] Blueprints e malhas placeholder no editor
- [ ] Sistema de construção (preview/snap de máquinas)
- [ ] UI de inventário e hub de pesquisa
- [ ] Mapa Terra com World Partition + biomas
- [ ] Save/Load

Veja o GDD em [`docs/GDD.md`](docs/GDD.md) para o design completo.
