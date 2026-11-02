# Atividade 4 — Calibração com as fotos reais

52 fotos lidas; 27 com gabarito de sequência (13 do tabuleiro 1, 14 do tabuleiro 2) e 18 casos difíceis (mão, sombra, peça sozinha). Gabarito = forma das casas novas, sem usar a cor.

## 0. A câmera clareia a foto conforme entram peças

Brilho médio do papel branco da margem (nunca coberto por peças):

| foto | papel (0–255) |
| --- | --- |
| tabuleiro_vazio | 197 |
| tabuleiro_1_3_pecas | 199 |
| tabuleiro_1_7_pecas | 217 |
| tabuleiro_1_completo | 225 |
| tabuleiro_2_completo | 218 |

Com o papel mais claro, as peças também saem mais claras (a peça V mede L≈16 com 3 peças em jogo e L≈28 com o tabuleiro cheio). Isso é a maior fonte de erro e pede **travar exposição e balanço de branco** no app da câmera (DroidCam/IP Webcam têm essa opção).

## 1. Distâncias entre as cores reais (pares mais próximos)

Distância Lab entre as medianas de cada cor. “Soltas” = paleta feita com as fotos de uma peça sozinha; “no tabuleiro” = mediana das casas rotuladas nas fotos com o tabuleiro montado. A última coluna pesa a luminosidade por 0.5 (a escolha da seção 2).

| par | soltas | no tabuleiro | no tabuleiro, L×0.5 |
| --- | --- | --- | --- |
| V–Z | 6.9 | 12.7 | 6.5 |
| I–T | 18.9 | 14.4 | 11.7 |
| L–N | 18.4 | 16.8 | 14.7 |
| U–Y | 29.6 | 21.2 | 18.7 |
| L–Y | 22.2 | 24.7 | 24.5 |
| Y–Z | 34.5 | 32.7 | 31.0 |
| N–P | 29.3 | 33.6 | 32.8 |
| N–Y | 33.4 | 34.6 | 34.2 |

## 2. Espaço de cor

Cada casa rotulada é classificada pela cor mais próxima da paleta. Paleta “no tabuleiro” é treinada num tabuleiro e testada no outro (validação cruzada, sem vazamento).

| espaço / distância | paleta | erros | principais confusões |
| --- | --- | --- | --- |
| Lab (L×1) | peças soltas | 121/1620 (7.5%) | V→Z ×82, U→Y ×18, vazio→Z ×11 |
| Lab (L×1) | no tabuleiro | 33/1620 (2.0%) | vazio→Z ×22, V→Z ×11 |
| Lab (L×0,5) | peças soltas | 121/1620 (7.5%) | V→Z ×77, U→Y ×24, T→I ×10 |
| Lab (L×0,5) | no tabuleiro | 15/1620 (0.9%) | V→Z ×11, T→I ×3, Y→U ×1 |
| Lab só a,b | peças soltas | 147/1620 (9.1%) | V→Z ×73, U→Y ×27, T→I ×16 |
| Lab só a,b | no tabuleiro | 101/1620 (6.2%) | Z→V ×58, V→Z ×28, T→I ×5 |
| HSV | peças soltas | 126/1620 (7.8%) | V→Z ×87, vazio→Z ×22, L→Y ×9 |
| HSV | no tabuleiro | 38/1620 (2.3%) | vazio→Z ×25, V→Z ×11, L→N ×1 |
| Lab (L×0,5) + normalização pelo papel | no tabuleiro | 11/1620 (0.7%) | V→Z ×10, T→I ×1 |

A normalização pelo papel (última linha) ajuda pouco e não entrou no pipeline; travar a exposição no app resolve o mesmo problema sem código.

**Escolha: Lab, com a luminosidade pesando 0.5** (`peso_l` em `config.py`). O HSV e o Lab sem L erram mais; o Lab puro erra 33, com L×0.5 erra 15. O L não pode sumir (V e Z só diferem nele) nem pesar demais (sombra no papel parece cor). O que mais derruba o erro é a paleta ser medida **no tabuleiro montado**, não com as peças soltas.

## 3. Pares perigosos (resultado cruzado, Lab L×0,5)

| par | casas do par | confundidas | taxa | distância na paleta |
| --- | --- | --- | --- | --- |
| I–T | 220 | 3 | 1.4% | 11.7 |
| L–N | 190 | 0 | 0.0% | 14.7 |
| U–Y | 125 | 1 | 0.8% | 18.7 |
| V–Z | 165 | 11 | 6.7% | 6.5 |

## 4. Limiar de “incerto”

Distância (L×0.5) até a cor mais próxima. Acertos do teste cruzado: mediana 2.4, p95 12.6, p99 19.1. Casas de casos difíceis (mão, sombra, peça sozinha) classificadas com a paleta final:

| limiar | acertos marcados “?” | casos difíceis errados e aceitos | fotos do teste com ≤ 3 “?” |
| --- | --- | --- | --- |
| 10 | 7.1% | 14/161 | 16/27 |
| 12 | 5.4% | 24/161 | 16/27 |
| 14 | 4.2% | 42/161 | 22/27 |
| 16  ← escolhido | 3.4% | 63/161 | 25/27 |
| 18 | 1.8% | 116/161 | 25/27 |
| 20 | 0.3% | 142/161 | 26/27 |

**Escolha: `limiar_incerto = 16.0` e `max_incertas = 3`.** O padrão antigo (20) não marcava quase nada de mão/sombra. Com 16, um quadro normal passa (≤ 3 casas “?”) e um quadro com mão ou sombra forte é descartado. As fotos que falham são as de `luz_diferente`: é o comportamento certo — mudou a luz, recalibre.

Limites do limiar: uma casa errada **com cor parecida** com a certa (V↔Z) fica perto da paleta e não vira “?”; e a pele da mão cai quase sempre em **Z** (marrom). Quem trata a mão é o descarte por movimento/oclusão (`estabilizacao.py`), não só o limiar.

Casas incertas por foto de “mão” (limiar escolhido):

- `tabuleiro_vazio_mao`: 30 casas incertas → descartado
- `tabuleiro_vazio_mao_em_cima`: 24 casas incertas → descartado
- `tabuleiro_1_mao`: 29 casas incertas → descartado
- `tabuleiro_2_completo_mao`: 21 casas incertas → descartado

## 5. Teste em tabuleiro que não entrou na calibração

Fotos do 3º tabuleiro, classificadas com a paleta final; conta as peças cujas 5 casas formam a forma certa.

- `WhatsApp Image 2026-10-29 at 13.51.31 (1)`: 4/12 peças com forma correta (erradas: F, P, U, V, W, X, Y, Z), 17 casas incertas → descartada pelo limiar
- `WhatsApp Image 2026-10-29 at 13.51.32 (1)`: 3/12 peças com forma correta (erradas: F, I, L, N, T, V, W, X, Z), 4 casas incertas → descartada pelo limiar
- `WhatsApp Image 2026-10-29 at 13.51.33 (1)`: 10/12 peças com forma correta (erradas: V, Z), 0 casas incertas → aceita

## 6. Plano B (ArUco)

**Acionar para: V–Z.** Critério: par com ≥ 2% das casas trocadas no teste cruzado ou distância ponderada < 8 na paleta. 
- V–Z: 11 casas trocadas (6.7%), distância 6.5.

Os demais pares separam por cor. Imprimir ArUco só para as peças do par (não as 12). Antes de imprimir, vale tentar o desempate pela forma/votação da peça inteira, que a cor sozinha não faz, e travar a exposição; se o par ainda trocar, siga com o ArUco.

## 7. Limitações desta amostra

- Dois tabuleiros montados + um de teste, uma mesa e uma folha; a paleta vale para essa luz.
- A paleta deve ser refeita no local definitivo, com o tabuleiro **cheio** e a exposição travada.
- A cor das peças é medida em Lab; trocar a câmera/app pode deslocar tudo.
