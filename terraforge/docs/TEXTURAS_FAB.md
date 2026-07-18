# TerraForge — Texturas reais do planeta com assets da Fab

O terreno procedural já sai com **UVs de mundo tiladas** e procura sozinho um
material chamado **`/Game/TerraForge/M_Terrain`**. Ou seja: você só precisa
baixar texturas da Fab e montar esse material uma vez — o código aplica no
planeta automaticamente (se não existir, ele volta para as cores low-poly).

## 1. O que baixar na Fab (grátis)

Abra a Fab **dentro do editor**: menu **Window → Fab** (plugin já embutido na
UE 5.6; faça login com sua conta Epic). Pesquise e clique em **Add to Project**:

| Busca na Fab | O que é | Uso no planeta |
|---|---|---|
| **MW Landscape Auto Material** | Pacote **gratuito** com texturas de grama, pedra, terra e material automático | A opção mais completa em um download só |
| `grass` (filtro **Free**, tipo *Material/Surface*) | Superfícies Quixel Megascans e similares gratuitas | Campo |
| `rock cliff` (Free) | Pedra/encosta | Montanhas |
| `snow` (Free) | Neve | Picos |
| `sand beach` (Free) | Areia | Praias e margens |

> Dica: no site fab.com também dá para filtrar por preço = Free e
> "Compatible with Unreal Engine". Tudo que você adquirir fica na sua
> biblioteca para sempre.

## 2. Criar o material do planeta (uma vez só)

### Nível 1 — básico (5 minutos, já muda tudo)

1. No Content Browser, crie a pasta **`TerraForge`** (dentro de Content).
2. Botão direito nela → **Material** → nomeie **`M_Terrain`**
   (o caminho final tem que ser exatamente `/Game/TerraForge/M_Terrain`).
3. Abra o material. Arraste a **textura de grama** (do pacote baixado) para o
   gráfico → vira um nó *Texture Sample*.
4. Ligue o pino **RGB** dele em **Base Color**. Se o pacote tiver Normal Map,
   arraste também e ligue em **Normal**.
5. **Salvar**. Pronto: aperte Play e o planeta inteiro estará texturizado
   (as UVs do gerador repetem a textura a cada 10 m — ajuste com
   `TextureTileSize` no ator TerrainGenerator se quiser mais fino/grosso).

### Nível 2 — pedra nas encostas (mais 10 minutos)

1. Adicione um *Texture Sample* com a **textura de pedra**.
2. Nó **VertexNormalWS** → **ComponentMask** (só **B**) → esse valor é 1 no
   plano e ~0 na encosta.
3. Nó **SmoothStep** (Min 0.55, Max 0.8) com isso → use como **Alpha** de um
   nó **Lerp**: A = pedra, B = grama → resultado em **Base Color**.

### Nível 3 — neve no alto e areia embaixo

1. Nó **Absolute World Position** → ComponentMask (**B**, que é o Z).
2. Z com **SmoothStep** (1400 → 1800) como Alpha de outro **Lerp**:
   A = resultado anterior, B = **neve**.
3. Areia: SmoothStep do Z invertido perto de -90 (nível da água é -150) com
   Lerp para a **textura de areia**.
4. (Toque final) Multiplique o Base Color pelo nó **Vertex Color** com um
   Lerp fraco (0.85) — os biomas do gerador tingem sutilmente as texturas,
   dando variação de cor por região.

## 3. Alternativa profissional (quando quiser o próximo nível)

Os "Landscape Auto Materials" da Fab (MW, Brushify, Landscape Pro) foram
feitos para o **Landscape** nativo da UE (terreno esculpível do editor), com
camadas pintáveis, grama automática e distância de LOD. O caminho:

1. Crie um **Landscape** no editor (modo Landscape → esculpa montanhas/vales).
2. Aplique o auto material do pacote (instruções do próprio pacote).
3. No GameMode (ou num Blueprint filho), desligue **bGenerateTerrain** —
   os veios, fábrica, dia/noite e HUD continuam funcionando sobre o Landscape,
   pois tudo se apoia em traces de chão.

## Resumo

- **Hoje**: baixe o *MW Landscape Auto Material* (grátis) + 3–4 superfícies
  free, monte o `M_Terrain` nível 1 → planeta texturizado.
- **Depois**: evolua para os níveis 2–3 (pedra/neve/areia automáticas).
- **Um dia**: Landscape esculpido + auto material completo.
