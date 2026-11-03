import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { Cell, PentominoId } from "@/lib/types/pentomino";

// Mesmas regras de visao/validador.py.

function normalizar(casas: Cell[]): string {
  const minR = Math.min(...casas.map(([r]) => r));
  const minC = Math.min(...casas.map(([, c]) => c));

  return casas
    .map(([r, c]) => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([r, c]) => `${r},${c}`)
    .join(";");
}

function orientacoes(casas: Cell[]): Set<string> {
  const resultado = new Set<string>();
  let atual = casas;

  for (let i = 0; i < 4; i++) {
    atual = atual.map(([r, c]) => [c, -r] as Cell);
    resultado.add(normalizar(atual));
    resultado.add(
      normalizar(atual.map(([r, c]) => [r, -c] as Cell)),
    );
  }

  return resultado;
}

function conexa(casas: Cell[]): boolean {
  const chaves = new Set(casas.map(([r, c]) => `${r},${c}`));
  const visitadas = new Set<string>();
  const pilha = [casas[0]];

  while (pilha.length > 0) {
    const [r, c] = pilha.pop()!;
    const chave = `${r},${c}`;

    if (visitadas.has(chave) || !chaves.has(chave)) continue;

    visitadas.add(chave);
    pilha.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }

  return visitadas.size === casas.length;
}

export function motivoPecaInvalida(
  peca: PentominoId,
  casas: Cell[],
): string {
  if (casas.length !== 5) {
    return `${casas.length} casas (esperado 5)`;
  }

  if (!conexa(casas)) {
    return "casas não conectadas";
  }

  const forma = PENTOMINOES.find((p) => p.id === peca);

  if (
    forma &&
    !orientacoes(forma.cells).has(normalizar(casas))
  ) {
    return "forma não corresponde";
  }

  return "peça inválida";
}
