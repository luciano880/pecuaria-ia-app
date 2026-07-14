# TerraForge — Narrativa: Projeto Êxodo

## Premissa

**Ano 2049.** Décadas de exploração descontrolada levaram a Terra ao limite:
clima instável, solos exauridos, ecossistemas em colapso em cascata. Os modelos
científicos convergem em uma previsão — **em 20 anos o planeta não sustentará
mais a civilização**.

A resposta da humanidade é o **Projeto Êxodo**: construir uma nave colonial
capaz de levar um núcleo da espécie (embriões, sementes, conhecimento e uma
tripulação mínima) para um mundo habitável já mapeado.

Você é **engenheiro(a)-chefe de um dos Sítios Êxodo** — regiões ricas em
minérios escolhidas para erguer, cada uma, um módulo da nave. Seu trabalho:
transformar uma região intocada em um complexo industrial capaz de produzir
peças que a humanidade nunca fabricou em tamanha escala.

## A ironia central (o coração do jogo)

Para salvar a espécie da destruição ambiental… **você precisa industrializar e
poluir**. Cada tonelada de aço para a nave suja o ar da região. O jogo pergunta
o tempo todo: *quanto do presente você sacrifica pelo futuro?*

É essa tensão que conecta as duas mecânicas centrais:
- **Produção** (tiers, fábricas, energia) → avança o Projeto Êxodo.
- **Índice ambiental** (poluição, recuperação) → decide o destino da Terra.

## Estrutura em atos (= tiers)

| Ato | Tier | Momento narrativo |
|---|---|---|
| 1. Chegada | 0–1 | Você chega ao Sítio com equipamento básico. Primeiro contato com a região: bela, intocada. Rádio com a coordenação do Êxodo. |
| 2. Escalada | 2–3 | Siderurgia e petroquímica. As primeiras metas da nave chegam. A paisagem começa a mudar — e a coordenação ignora os alertas ambientais. |
| 3. O preço | 4 | Energia nuclear, produção máxima. Eventos mostram o custo: chuva ácida, êxodo de animais, um Sítio vizinho entra em colapso. Surge a facção **Raízes** — cientistas que acreditam que ainda dá para regenerar o planeta. |
| 4. A escolha | 5 | Com a tecnologia verde desbloqueada, o jogador decide qual final perseguir (ou ambos, no New Game+). |

## Dois finais

### Final A — Êxodo (partir)
Completar todos os **módulos da nave** entregues no Hub:
casco estrutural → sistemas de suporte de vida → motor de fusão →
computador de navegação → arca genética.
A nave parte. Cutscene: a Terra fica para trás, cicatrizada pelas suas fábricas.
*"A espécie sobrevive. O lar, não."*

### Final B — Regeneração (ficar)
Manter o **índice ambiental ≥ 80 por 30 dias seguidos** com a base ainda
funcionando: matriz 100% limpa (geotérmica/solar/eólica/nuclear), reciclagem,
reflorestamento das áreas mineradas.
Cutscene: a natureza retoma as estruturas; a nave, inacabada, vira monumento.
*"Ninguém precisou partir."*

**Final secreto — Legado:** completar a nave E regenerar o planeta no mesmo
save. A nave parte vazia de colonos, carregando apenas a arca genética — um
backup, não uma fuga.

## Entregas no Hub = módulos da nave

As metas de tier do `UTierProgressionSubsystem` são diegéticas: cada entrega
no **Hub Êxodo** (`AExodusHub`) é oficialmente um lote de peças para o módulo
em construção, visível na plataforma de lançamento ao lado do Hub — a nave
**cresce fisicamente** conforme os tiers avançam (5 estágios de malha).

## Tom

- Sem vilão humano: o antagonista é o tempo e as consequências acumuladas.
- Narração ambiental: a degradação (e a recuperação) da paisagem É a história.
- Textos curtos via rádio/terminal, nunca cutscenes longas no meio do gameplay.
