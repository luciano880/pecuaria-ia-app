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
| 0 | Acampamento | Picareta, mineradora portátil, fogueira de fundição | 50x Minério de Ferro |
| 1 | Mecanização | Miner Mk1, esteira Mk1, fundição a carvão | 100x Lingote de Ferro |
| 2 | Eletrificação | Gerador a carvão, rede elétrica, Miner Mk2 | 200x Placa de Ferro, 100x Fio de Cobre |
| 3 | Indústria Pesada | Fundição elétrica, esteira Mk2, escavadeira de superfície | 500x Aço, 200x Concreto |
| 4 | Automação Avançada | Braços robóticos, trens de carga, Miner Mk3 | 100x Motor, 100x Circuito |
| 5 | Era Verde | Solar/eólica, recuperação de área, mineração profunda | 50x Bateria de Lítio, índice ambiental ≥ 80 |

Cada tier multiplica velocidade/capacidade das máquinas e abre novas receitas.
Upgrade de máquina é **in-place**: interagir com a máquina + pagar o custo → Mk seguinte.

## 4. Recursos e cadeia produtiva (inicial)

```
Minério de Ferro ──► Lingote de Ferro ──► Placa / Haste ──► Peças
Minério de Cobre ──► Lingote de Cobre ──► Fio / Chapa
Carvão ──► combustível (fundição, gerador)
Calcário ──► Concreto (construções)
Lítio (tier 5) ──► Baterias
```

## 5. Energia

- Máquinas elétricas consomem **MW** de uma rede (grid) conectada por postes/cabos.
- Produção < consumo → todas as máquinas do grid reduzem velocidade proporcionalmente
  (brownout), em vez de desligar tudo (mais amigável que fusível do Satisfactory).
- Fontes: gerador a carvão (t2) → hidrelétrica (t3) → solar/eólica (t5, sem poluição).

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
