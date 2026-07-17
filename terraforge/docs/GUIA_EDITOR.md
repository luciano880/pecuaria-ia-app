# TerraForge — Guia de Setup no Editor UE5

## Início rápido (ZERO configuração no editor)

O projeto agora se monta sozinho — inputs, malhas placeholder, itens, metas e
uma fábrica demo são todos criados por código. O caminho até jogar é:

1. Instale **UE 5.4+** e **Visual Studio 2022** (workload *Game development with C++*).
2. Botão direito em `TerraForge.uproject` → **Generate Visual Studio project files**.
3. Abra `TerraForge.sln`, selecione **Development Editor | Win64**, compile (Ctrl+Shift+B).
4. Abra o `TerraForge.uproject` (ele abre num mapa template do engine com chão e luz).
5. Aperte **Play**. Pronto:
   - Uma **fábrica demo** nasce montada perto do spawn: jazida de ferro →
     mineradora (azul) → esteira → fundição (laranja) → esteira → **Hub Êxodo**
     (dourado), com uma **usina de biomassa** (vermelha) já abastecida.
   - O minério flui sozinho; quando 50 unidades chegarem ao Hub, o Output Log
     mostra `Tier avançado para 1`.

### Controles (criados por código)

| Tecla | Ação |
|---|---|
| **WASD + mouse + Espaço** | mover / olhar / pular |
| **E** | interagir: coleta o buffer de saída da máquina na mira |
| **B** | modo construção: cicla mineradora → fundição → gerador |
| **Clique esq.** | construir no local do preview |
| **Q** | cancelar construção |
| **R** | girar o preview |

> O preview de construção fica branco (sem os materiais verde/vermelho, que são
> assets). A posição ainda é validada — se não construir, o local é inválido.

### O que observar no primeiro Play

- Esferas pequenas viajando nas esteiras = itens em trânsito.
- `Window → Output Log`, filtro `LogTerraForge`: tier, energia, construção.
- A usina de biomassa tem 100 de combustível; quando acabar, as máquinas
  entram em brownout. Interaja com máquinas para coletar itens (o personagem
  começa com 50 de biomassa para reabastecer — deposite via UI futuramente).

---

## Personalização no editor (opcional, quando quiser evoluir o visual)

Tudo abaixo é OPCIONAL — os padrões em C++ continuam valendo até você substituí-los.

### Mapa próprio
Crie um level (Basic), salve como `Content/Maps/L_Cerrado` e atualize
`Config/DefaultEngine.ini` (`GameDefaultMap`/`EditorStartupMap`). Espalhe
`AResourceNode` (defina `OreType`) e desligue `bSpawnDemoFactory` num
Blueprint filho do GameMode para montar a fábrica você mesmo.

### Input com assets
Crie Input Actions/IMC próprios e atribua no Blueprint filho do personagem —
quando `DefaultMappingContext` está preenchido, o input por código é ignorado.

### Visual
- Blueprints filhos das máquinas: troque a malha do componente `Mesh` por
  modelos reais; `MachineTint` deixa de importar quando o material não tem
  parâmetro `Color`.
- Materiais translúcidos verde/vermelho no componente `BuildSystem`
  (`ValidPreviewMaterial` / `InvalidPreviewMaterial`).
- `BP_Hub`: preencha `ShipStageMeshes` com os 5 estágios da nave.

### Itens e receitas com Data Assets
Crie Data Assets de `UItemData` e configure receitas/metas em Blueprints.
O `UGameDataSubsystem` só cria os itens padrão como fallback — Data Assets
seus têm prioridade onde forem atribuídos.

## Problemas comuns

- **Nada acontece no Play**: veja o Output Log (filtro `LogTerraForge`).
  A fábrica demo loga a posição onde nasceu — ela fica a ~15 m do spawn.
- **Máquinas pararam**: combustível da usina acabou (brownout). 
- **Esteira sem itens**: confira se a mineradora está sobre a jazida
  (a demo já nasce correta; construções manuais usam raio de busca de 4 m).
