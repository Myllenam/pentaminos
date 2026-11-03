import { formaCorresponde } from "@/lib/fisico/forma";
import { AtribuirPeca, Duvida } from "@/lib/types/fisico";
import { Cell, PentominoId } from "@/lib/types/pentomino";

const LETRAS = [..."FILNPTUVWXYZ"] as PentominoId[];

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

// Por que a seleção não pode ser confirmada (null = pode).
export function motivoSelecao(casas: Cell[], peca: PentominoId): string | null {
  if (casas.length !== 5) {
    return `Marque 5 casas (agora são ${casas.length}).`;
  }
  return formaCorresponde(peca, casas)
    ? null
    : `As casas marcadas não formam a peça ${peca}.`;
}

// Mensagem para o ws.py ou, se a seleção não formar a peça, o motivo.
export function montarAtribuicao(
  casas: Cell[],
  peca: PentominoId,
): AtribuirPeca | string {
  const motivo = motivoSelecao(casas, peca);
  if (motivo) return motivo;

  const ordenadas = [...casas].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { type: "assign_piece", cells: ordenadas, piece: peca };
}

// Dúvida mostrada agora (uma de cada vez) e a contagem "1 de 3".
export function duvidaAtual(
  duvidas: Duvida[],
  id: string | null,
): { duvida: Duvida; contagem: string; proxima: string } | null {
  if (duvidas.length === 0) return null;

  const i = Math.max(0, duvidas.findIndex((d) => d.id === id));
  return {
    duvida: duvidas[i],
    contagem: `${i + 1} de ${duvidas.length}`,
    proxima: duvidas[(i + 1) % duvidas.length].id,
  };
}

// Letras do "Outra": as que faltam, menos as candidatas.
export function outrasLetras(validas: PentominoId[], candidatas: PentominoId[]): PentominoId[] {
  return LETRAS.filter((l) => !validas.includes(l) && !candidatas.includes(l));
}
