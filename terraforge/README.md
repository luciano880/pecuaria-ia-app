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
| `docs/HISTORIA.md` | Narrativa: **Projeto Êxodo** — a nave para salvar a espécie e os dois finais |
| `Source/TerraForge/Items` | Itens/recursos (Data Assets) e inventário do jogador |
| `Source/TerraForge/Resources` | Nós de recurso no mundo (jazidas de minério, gêiseres) |
| `Source/TerraForge/Machines` | Máquinas: base comum, mineradora, fundição, refinaria multi-processo, geradores a combustível e renováveis |
| `Source/TerraForge/Logistics` | Esteiras transportadoras |
| `Source/TerraForge/Power` | Rede elétrica (subsystem de mundo) |
| `Source/TerraForge/Environment` | Índice ambiental do planeta (poluição/penalidades/Final B) |
| `Source/TerraForge/Building` | Sistema de construção (preview fantasma, snap em grade, custo) |
| `Source/TerraForge/Player` | Personagem em primeira pessoa (Enhanced Input) |
| `Source/TerraForge/Progression` | Tiers tecnológicos + Hub Êxodo (a nave cresce a cada tier) |
| `Config/` | Configuração do projeto (GameMode padrão, mapas, etc.) |

## Roadmap resumido

- [x] Esqueleto C++: máquinas, recursos, esteiras, energia, tiers
- [x] Matriz energética: biomassa, carvão, petróleo, nuclear + geotérmica/solar/eólica
- [x] Sistema de construção (preview/snap de máquinas, custo em itens)
- [x] Personagem jogável, inventário e Hub Êxodo (narrativa)
- [x] Índice ambiental (poluição, penalidade, base do Final B)
- [ ] Blueprints, malhas placeholder e assets de Enhanced Input no editor
- [ ] UI (inventário, metas do tier, medidor ambiental, energia)
- [ ] Mapa Terra com World Partition + biomas
- [ ] Save/Load e os dois finais jogáveis

Veja o GDD em [`docs/GDD.md`](docs/GDD.md) para o design completo.
