# TerraForge — Passo a Passo COMPLETO (do zero até jogar)

Guia para quem nunca usou Unreal Engine. Tempo total: 1–2 h (maioria é download).

## Parte 0 — Requisitos
- Windows 10/11, ~100 GB livres, placa de vídeo razoável
- Downloads grandes (20–40 GB no total)

## Parte 1 — Instalar a Unreal Engine 5
1. unrealengine.com → Download → instale o **Epic Games Launcher**
2. Entre com uma conta Epic (grátis)
3. Menu lateral **Unreal Engine** → aba **Biblioteca**
4. Clique no **+** em "Versões do motor" → escolha **5.4** ou **5.5** → **Instalar**

## Parte 2 — Instalar o Visual Studio 2022 (compilador — OBRIGATÓRIO)
1. visualstudio.microsoft.com → baixe **Visual Studio Community 2022** (gratuito)
2. No instalador, marque a carga de trabalho ✅ **"Desenvolvimento de jogos com C++"**
3. Nos detalhes (direita), confirme ✅ Windows 10/11 SDK
4. Instalar → ao terminar, **reinicie o PC**

## Parte 3 — Baixar o jogo
Jeito fácil (ZIP direto do branch):

    https://github.com/luciano880/pecuaria-ia-app/archive/refs/heads/claude/earth-mining-sim-ue5-i5o0er.zip

1. Extraia para um caminho simples (ex.: C:\Jogos\)
2. Entre na pasta **terraforge** — nela está o `TerraForge.uproject`

Para receber atualizações com 1 clique depois: instale o **GitHub Desktop**,
clone `luciano880/pecuaria-ia-app` e troque para o branch
`claude/earth-mining-sim-ue5-i5o0er` (botão "Current branch").

## Parte 4 — Gerar arquivos do Visual Studio
1. Botão direito no `TerraForge.uproject`
   (Windows 11: clique antes em "Mostrar mais opções")
2. **Generate Visual Studio project files** → aguarde ~30 s → surge `TerraForge.sln`

Se a opção não aparecer: Epic Launcher → Unreal Engine → Biblioteca → setinha ▼
na versão → **Verificar**; ou dê 2 cliques no .uproject e associe ao
"Unreal Engine Version Selector".

## Parte 5 — Compilar
1. 2 cliques no `TerraForge.sln` → abre o Visual Studio
2. Nas caixas do topo: **Development Editor** e **Win64**
3. Menu **Compilar → Compilar Solução** (Ctrl+Shift+B)
4. Primeira vez demora 5–20 min. Sucesso = "2 com êxito, 0 com falha"
5. Se falhar: copie as linhas com "error" e envie para o Claude corrigir

## Parte 6 — Jogar
1. 2 cliques no `TerraForge.uproject` (primeira abertura compila shaders, aguarde)
2. Aperte **Play** ▶️ (ou Alt+P)

## Parte 7 — O que ver e controles
Fábrica demo a ~15 m do spawn: jazida (esfera ferrugem) → mineradora (cubo azul)
→ esteira com esferinhas viajando → fundição (laranja) → esteira → Hub Êxodo
(plataforma dourada), + usina de biomassa (torre vermelha) abastecida.

| Tecla | Ação |
|---|---|
| WASD / mouse / Espaço | mover / olhar / pular |
| E | coletar itens da máquina na mira |
| B | modo construção (cicla mineradora → fundição → gerador) |
| Clique esq. | construir |
| Q | cancelar |
| R | girar preview |

Acompanhe: **Window → Output Log**, filtro `LogTerraForge`.
Quando 50 minérios chegarem ao Hub: `Tier avançado para 1`.
