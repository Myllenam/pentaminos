import { formaCorresponde } from "@/lib/fisico/forma";
import { AtribuirPeca } from "@/lib/types/fisico";
import { Cell, PentominoId } from "@/lib/types/pentomino";

export function chaveCasa([linha, coluna]: Cell): string {
  return `${linha},${coluna}`;
}

// Liga ou desliga uma casa na seleção.
export function alternarCasa(selecao: Cell[], casa: Cell): Cell[] {
  const chave = chaveCasa(casa);
  return selecao.some((c) => chaveCasa(c) === chave)
    ? selecao.filter((c) => chaveCasa(c) !== chave)
    : [...selecao, casa];
}

// Mensagem para o ws.py ou, se a seleção não formar a peça, o motivo.
export function montarAtribuicao(
  casas: Cell[],
  peca: PentominoId,
): AtribuirPeca | string {
  if (!formaCorresponde(peca, casas)) {
    return `As casas marcadas não formam a peça ${peca}. Toque nas casas para ajustar.`;
  }

  const ordenadas = [...casas].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { type: "assign_piece", cells: ordenadas, piece: peca };
}
