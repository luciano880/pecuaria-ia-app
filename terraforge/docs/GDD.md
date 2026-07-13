# TerraForge — Game Design Document (v0.1)

## 1. Conceito

**Gênero:** Simulação de fábrica / automação em primeira pessoa (estilo Satisfactory).
**Cenário:** Planeta Terra, futuro próximo. O jogador lidera uma operação de mineração
que precisa se expandir de um acampamento improvisado até um complexo industrial global.
**Fantasia central:** transformar paisagens reais da Terra (cerrado, deserto, montanha,
tundra) em cadeias produtivas gigantes e eficientes — equilibrando produção com impacto
ambiental.

**Diferencial vs. Satisfactory:** por ser na Terra, existe uma mecânica de
**licença ambiental e recuperação de área** — poluir demais reduz eficiência e bloqueia
expansão; reflorestar/recuperar libera bônus.

## 2. Loop de gameplay

1. **Explorar** → encontrar jazidas (ferro, cobre, carvão, calcário, bauxita, lítio…).
2. **Extrair** → posicionar mineradoras sobre os nós de recurso.
3. **Transportar** → esteiras conectam máquinas entre si.
4. **Processar** → fundições e refinarias transformam minério em placas, lingotes, peças.
5. **Pesquisar** → entregar peças no Hub para desbloquear a próxima fase.
6. **Automatizar e escalar** → repetir com máquinas maiores e receitas mais complexas.

## 3. Fases tecnológicas (Tiers)

| Tier | Nome | Desbloqueia | Meta de entrega |
|---|---|---|---|
| 0 | Instalação Inicial | Mineradora portátil, forno básico | 50x Minério de Ferro |
| 1 | Mecanização | Miner Mk1, esteira Mk1, **usina de biomassa**, rede elétrica | 100x Lingote de Ferro |
| 2 | Siderurgia | **Termelétrica a carvão**, alto-forno (aço), Miner Mk2 | 200x Placa de Aço, 100x Fio de Cobre |
| 3 | Petroquímica | Poço de petróleo, **refinaria**, **usina a óleo combustível**, plásticos | 500x Aço, 300x Plástico, 200x Concreto |
| 4 | Alta Tecnologia | Eletrólise de alumínio, forno de silício, circuitos, **usina nuclear** | 100x Motor, 100x Circuito, 20x Barra de Urânio |
| 5 | Matriz Limpa (opcional) | **Geotérmica (gêiseres), solar, eólica**, reciclagem, mineração profunda | 50x Bateria de Lítio, índice ambiental ≥ 80 |

Cada tier multiplica velocidade/capacidade das máquinas e abre novas receitas.
Upgrade de máquina é **in-place**: interagir com a máquina + pagar o custo → Mk seguinte.

## 4. Recursos e cadeias produtivas (indústria moderna)

O jogo usa processos de fundição/refino inspirados na indústria real. Cada processo
é uma máquina diferente, com receitas multi-entrada/multi-saída (`ARefineryMachine`):

### Metalurgia
```
Alto-forno:        Minério de Ferro + Carvão + Calcário ──► Ferro-gusa + Escória
Aciaria (BOF):     Ferro-gusa + Sucata ──► Aço ──► Placa / Viga / Tubo
Forno elétrico:    Sucata + energia ──► Aço reciclado (tier 5, menos poluição)
Eletrorrefino:     Minério de Cobre ──► Cobre blister ──► Cobre eletrolítico ──► Fio / Chapa
Eletrólise:        Bauxita ──► Alumina ──► Alumínio (consome MUITA energia — tier 4)
Forno de silício:  Quartzo + Carvão ──► Silício metálico ──► Wafer ──► Circuito
```

### Petroquímica (tier 3)
```
Poço de petróleo ──► Petróleo cru
Refinaria: Petróleo cru ──► Óleo combustível + Nafta + Betume
Planta química: Nafta ──► Plástico / Borracha sintética
Betume + Brita ──► Asfalto (estradas/fundações)
```

### Construção e alta tecnologia
```
Calcário ──► Cimento ──► Concreto (com areia + água)
Silício + Cobre + Plástico ──► Circuitos ──► Computadores industriais
Lítio + Alumínio + Circuito ──► Baterias (tier 5)
Urânio ──► Barra de combustível nuclear (tier 4)
```

## 5. Energia — matriz elétrica

- Máquinas elétricas consomem **MW** de uma rede (grid) conectada por postes/cabos.
- Produção < consumo → todas as máquinas do grid reduzem velocidade proporcionalmente
  (brownout), em vez de desligar tudo (mais amigável que fusível do Satisfactory).

### Fontes principais (a combustível — `AGeneratorMachine`)

| Fonte | Tier | Combustível | Potência base | Poluição | Observação |
|---|---|---|---|---|---|
| **Biomassa** | 1 | Restos vegetais, madeira | 20 MW | Baixa | Primeira fonte; combustível renovável mas fraco |
| **Carvão** | 2 | Carvão mineral | 60 MW | Alta | Barata e abundante; pior índice ambiental |
| **Petróleo** | 3 | Óleo combustível (da refinaria) | 120 MW | Média-alta | Integra com a cadeia petroquímica |
| **Nuclear** | 4 | Barra de urânio | 500 MW | Zero (ar) | Gera **rejeito radioativo** que precisa de armazenamento |

### Fontes opcionais (renováveis — `ARenewableGenerator`)

| Fonte | Tier | Requisito | Potência | Comportamento |
|---|---|---|---|---|
| **Geotérmica** | 5 | Construir sobre um **gêiser** (nó especial no mapa) | 150 MW | Constante, 24h — a melhor renovável, mas limitada aos gêiseres |
| **Solar** | 5 | Área aberta | 40 MW pico | Segue o ciclo dia/noite (zero à noite) — pede baterias |
| **Eólica** | 5 | Morros/costa | 60 MW pico | Oscila com o vento (fator 30–100%) |

Estratégia esperada: começar em biomassa → escalar em carvão → migrar para petróleo
integrado à refinaria → base firme nuclear → complementar com renováveis para
recuperar o índice ambiental (tier 5 exige índice ≥ 80).

## 6. Impacto ambiental

- Cada máquina tem um valor de **poluição/min**; acumula por região.
- Poluição alta: -eficiência das máquinas na região, chuva ácida (visual), bloqueia
  licenças de expansão para novas regiões.
- Recuperação: plantar árvores, filtros, energia limpa → restaura o índice.

## 7. Mundo

- Mapa único grande (8x8 km inicialmente) com **World Partition**, inspirado em
  biomas reais: cerrado (início), serra ferrosa, deserto de cobre, costa (logística),
  montanha nevada (lítio/urânio).
- Nanite para terreno rochoso e maquinário; Lumen para iluminação dinâmica dia/noite.

## 8. Arquitetura técnica (UE5)

- **C++** para simulação (máquinas, grids, esteiras, progressão) — classes em `Source/`.
- **Blueprints** herdam das classes C++ para visual, sons e ajustes de designer.
- **Data Assets** (`UItemData`, `UMachineTierData`) para itens e balanceamento — nada
  de números hardcoded em código.
- **Subsystems**: `UPowerGridSubsystem` (mundo) e `UTierProgressionSubsystem`
  (game instance) — pontos únicos de verdade para energia e progressão.
- Esteiras: simulação por spline + instâncias (ISM) para performance com milhares
  de itens; sem física por item.
- Save/Load: `USaveGame` + serialização das máquinas por `FGuid`.

## 9. MVP (primeiro marco jogável)

1. Um bioma pequeno com nós de ferro, cobre e carvão.
2. Miner Mk1 → esteira → fundição → esteira → caixa de depósito.
3. Hub com metas do Tier 0→1→2.
4. Construção por "modo fantasma" (preview verde/vermelho + snap em grade).
5. Energia com um gerador a carvão e brownout funcionando.
