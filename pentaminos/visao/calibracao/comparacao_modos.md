# Comparação dos modos de identificação: cor × forma

Gerado por `cd pentaminos/visao && python comparar_modos.py --pasta fotos-pentaminos` (script `comparar_modos.py`). Todas as tabelas abaixo saem dele.

**Fotos:** 52 lidas e alinhadas. Com gabarito: 27 das sequências dos tabuleiros 1 e 2 (inclui as de `luz_diferente`) e 14 de peça sozinha. O gabarito é o do `calibrar_fotos.py` (casas novas de cada foto da sequência, nome pela forma). Fotos com mão (4) ficam fora das métricas de acerto e têm tabela própria.

**Paleta:** cruzada, como no relatório da calibração — fotos do tabuleiro 1 usam a paleta medida no tabuleiro 2 e vice-versa; peças soltas e o 3º tabuleiro usam a paleta dos dois. **Casa vazia (modo forma):** mediana por casa das fotos `tabuleiro_vazio*`.

**Atenção:** o gabarito marca casa ocupada por croma (cor saturada contra o papel), uma ideia parecida com a ocupação do modo forma; por isso a ocupação do modo forma tende a concordar com ele.

## 1. Calibração dos limiares do modo forma

Distância (Lab, L×0.5) até a casa vazia: vazias p99 18.0, máx. 21.0; ocupadas mín. 30.4, p1 31.5. Escolha: `limiar_ocupada = 26.0` com `margem_ocupada = 4.0` (vazia abaixo de 22.0, ocupada acima de 30.0, “?” entre os dois).

Distância entre casas vizinhas: da mesma peça p95 8.5, p99 12.5, máx. 15.8; de peças diferentes mín. 3.7, p5 6.6. Os intervalos se sobrepõem (V–Z, I–T, U–Y): abaixo do limiar as peças se juntam e a divisão por forma separa; acima, uma peça pode se partir.

| limiar_mesma_peca | casas certas | peças certas | vitórias (completos) | vitórias falsas |
| --- | --- | --- | --- | --- |
| 8 | 100.0% | 100.0% | 3/3 | 0 |
| 10 | 100.0% | 100.0% | 3/3 | 0 |
| 12 | 100.0% | 100.0% | 3/3 | 0 |
| 14 | 100.0% | 100.0% | 3/3 | 0 |
| 16 | 100.0% | 100.0% | 3/3 | 0 |
| 18 | 100.0% | 100.0% | 3/3 | 0 |
| 20  ← padrão | 100.0% | 100.0% | 3/3 | 0 |
| 24 | 100.0% | 100.0% | 3/3 | 0 |
| 28 | 100.0% | 100.0% | 3/3 | 0 |
| 32 | 100.0% | 100.0% | 3/3 | 0 |

A varredura usa as mesmas fotos da comparação; o 3º tabuleiro (seção 5) é o teste de fora. Padrão 20.0: dentro da faixa que acerta tudo e com folga acima da maior distância entre casas da mesma peça (15.8), para uma peça não se partir com outra luz.

## 2. Resultado geral (fotos com gabarito)

| modo | casas certas | peças com nome e casas certos | vitórias (tabuleiros completos) | vitórias falsas (incompletos) |
| --- | --- | --- | --- | --- |
| cor | 96.0% | 73.2% | 0/3 | 0 |
| forma | 100.0% | 100.0% | 3/3 | 0 |
| combinado (decide por peça) | 100.0% | 100.0% | 3/3 | 0 |
| forma sem `vazio.json` (casa vazia = “.” da paleta) | 100.0% | 100.0% | 3/3 | 0 |

Tempo médio por foto só da etapa de rótulos (sem retificar): cor 0.2 ms, forma 2.0 ms, combinado 2.2 ms. O loop ao vivo roda a 10 quadros/s (100 ms por quadro).

## 3. Por número de peças no tabuleiro

| peças | fotos | casas — cor | casas — forma | peças — cor | peças — forma | peças — combinado | vitória — cor | vitória — forma | vitória — combinado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 16 | 97.1% | 100.0% | 75.0% | 100.0% | 100.0% | — | — | — |
| 2 | 3 | 88.3% | 100.0% | 100.0% | 100.0% | 100.0% | — | — | — |
| 3 | 2 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | — | — | — |
| 4 | 2 | 99.2% | 100.0% | 87.5% | 100.0% | 100.0% | — | — | — |
| 5 | 2 | 98.3% | 100.0% | 80.0% | 100.0% | 100.0% | — | — | — |
| 6 | 2 | 97.5% | 100.0% | 75.0% | 100.0% | 100.0% | — | — | — |
| 7 | 2 | 97.5% | 100.0% | 71.4% | 100.0% | 100.0% | — | — | — |
| 8 | 2 | 96.7% | 100.0% | 68.8% | 100.0% | 100.0% | — | — | — |
| 9 | 2 | 96.7% | 100.0% | 72.2% | 100.0% | 100.0% | — | — | — |
| 10 | 3 | 95.0% | 100.0% | 60.0% | 100.0% | 100.0% | — | — | — |
| 11 | 2 | 96.7% | 100.0% | 77.3% | 100.0% | 100.0% | — | — | — |
| 12 | 3 | 89.4% | 100.0% | 69.4% | 100.0% | 100.0% | 0/3 | 3/3 | 3/3 |

Peças certas = a letra do gabarito ocupa exatamente as mesmas casas na previsão. Vitória só existe com 12 peças; vitórias falsas com 1 a 11 peças: cor 0, forma 0, combinado 0.

## 4. Fotos com mão (devem ser descartadas)

O pipeline descarta o quadro com mais de 10 casas “?” na leitura por cor, em qualquer modo (a coluna “cor”).

| foto | “?” — cor | “?” — forma | vitória — cor | vitória — forma |
| --- | --- | --- | --- | --- |
| `tabuleiro_vazio_mao` | 30 | 31 | False | False |
| `tabuleiro_vazio_mao_em_cima` | 24 | 31 | False | False |
| `tabuleiro_1_mao` | 29 | 35 | False | False |
| `tabuleiro_2_completo_mao` | 21 | 36 | False | False |

## 5. 3º tabuleiro (fora da calibração)

Estas fotos **não têm gabarito**: o `calibrar_fotos.py` só monta gabarito para as sequências (uma peça nova por foto) e para peças sozinhas. Por isso casas certas e peças certas não podem ser calculadas aqui. O tabuleiro está completo, então o certo é detectar vitória; também conto as peças válidas (5 casas com a forma da letra) e mostro a grade de cada modo para conferir na foto.

| foto | peças válidas — cor | peças válidas — forma | peças válidas — combinado | “?” — cor | “?” — forma | vitória — cor | vitória — forma | vitória — combinado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `WhatsApp Image 2026-10-29 at 13.51.31 (1)` | 4/12 | 12/12 | 12/12 | 17 | 0 | False | True | True |
| `WhatsApp Image 2026-10-29 at 13.51.32 (1)` | 3/12 | 3/12 | 3/12 | 4 | 25 | False | False | False |
| `WhatsApp Image 2026-10-29 at 13.51.33 (1)` | 10/12 | 12/12 | 12/12 | 0 | 0 | False | True | True |

`WhatsApp Image 2026-10-29 at 13.51.31 (1)` — cor | forma:

```
TTTXLLVVVV   TTTXLLVVVZ
ITX??LVVVV   ITXXXLVZZZ
ITN?XLVV??   ITNXWLVZPP
INNWXLF???   INNWWLFFPP
INWW?FF?PU   INWWYFFUPU
IN????F???   INYYYYFUUU
```

`WhatsApp Image 2026-10-29 at 13.51.32 (1)` — cor | forma:

```
ZZZZZZZVVV   ?????Z?VVV
ZZ??Z?VVZV   ???????V?V
ZTZZZZZZPP   ?T?????ZPP
ZZNZZZZFPP   ZZN??Z?FPP
INWWYZFUPU   INWWY?FUPU
INYYYY?UUU   INYYYY?UUU
```

`WhatsApp Image 2026-10-29 at 13.51.33 (1)` — cor | forma:

```
TTTXLLVVVZ   TTTXLLVVVZ
ITXXXLVZZZ   ITXXXLVZZZ
ITNXWLZZPP   ITNXWLVZPP
INNWWLFFPP   INNWWLFFPP
INWWYFFUPU   INWWYFFUPU
INYYYYFUUU   INYYYYFUUU
```

## 6. Recomendação

**Padrão: `identificacao = "combinado"`.** O modo combinado roda os dois e decide por peça: fica com a peça válida do modo forma e, onde o forma não resolve, com a peça válida do modo cor. Falta confirmar com uma partida ao vivo com a câmera real.

- Fotos com gabarito: casas certas cor 96.0%, forma 100.0%, combinado 100.0%; peças certas cor 73.2%, forma 100.0%, combinado 100.0%; vitória nos tabuleiros completos cor 0/3, forma 3/3, combinado 3/3. A diferença cresce com o número de peças (seção 3).
- 3º tabuleiro, fora da calibração: vitória em 2/3 fotos no combinado, 2/3 no forma e 0/3 no cor.
  - `WhatsApp Image 2026-10-29 at 13.51.32 (1)` falha em todos os modos: 3/12 peças válidas e 25 casas “?” no combinado; para o descarte contam as 4 da leitura por cor (limite 10), então o quadro é publicado, e as peças inválidas viram perguntas ao jogador depois de 2 s.
- Fotos com mão: descartadas em 4/4.
- Custo: poucos milissegundos por quadro (seção 2), bem abaixo dos 100 ms do loop.

**Limites desta medição:**

- O gabarito dá nome às peças pela forma e marca ocupação por croma; isso favorece o modo forma no nome das peças. O que ele mede de forma independente é a separação de peças encostadas.
- São só 3 tabuleiros completos com gabarito e 3 fotos de teste, uma mesa e uma luz.
- Os limiares foram escolhidos nessas mesmas fotos; o 3º tabuleiro é o único teste de fora.
- Forma sem `vazio.json` (casa vazia = “.” da paleta): 100.0% das casas, 100.0% das peças, vitória em 3/3 (seção 2). Vale criá-lo no local definitivo (`python forma.py FOTO_DO_TABULEIRO_VAZIO`).
