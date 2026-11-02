import type { ReactNode } from "react";

import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { COLUNAS_FISICO } from "@/lib/types/fisico";
import { cn } from "@/lib/utils";

const CORES = new Map<string, string>(
  PENTOMINOES.map((shape) => [shape.id, shape.color]),
);

const HACHURA_INCERTA =
  "repeating-linear-gradient(45deg, #e4e4e7 0 6px, #f4f4f5 6px 12px)";

interface BoardFisicoProps {
  grade: string[]; // 6 strings de 10 caracteres
  pecasInvalidas?: ReadonlySet<string>;
  // Aviso por cima da grade.
  sobreposicao?: ReactNode;
  // Casas marcadas numa dúvida ("linha,coluna") e o toque para ajustar.
  selecionadas?: ReadonlySet<string>;
  onCasaClick?: (linha: number, coluna: number) => void;
  className?: string;
}

export function BoardFisico({
  grade,
  pecasInvalidas,
  sobreposicao,
  selecionadas,
  onCasaClick,
  className,
}: BoardFisicoProps) {
  return (
    <div className={cn("relative w-full max-w-[640px]", className)}>
      <div
        role="grid"
        aria-label="Tabuleiro físico"
        className="grid w-full overflow-hidden rounded-md border border-gray-200 bg-white"
        style={{
          gridTemplateColumns: `repeat(${COLUNAS_FISICO}, minmax(0, 1fr))`,
        }}
      >
        {grade.map((linha, row) =>
          [...linha].map((casa, col) => {
            const cor = CORES.get(casa);
            const incerta = casa === "?";
            const invalida = !!cor && !!pecasInvalidas?.has(casa);
            const marcada = !!selecionadas?.has(`${row},${col}`);

            return (
              <div
                key={`${row}-${col}`}
                role="gridcell"
                aria-selected={selecionadas ? marcada : undefined}
                onClick={onCasaClick ? () => onCasaClick(row, col) : undefined}
                aria-label={
                  cor
                    ? `${casa}${invalida ? " (inválida)" : ""}`
                    : incerta
                      ? "incerta"
                      : "vazia"
                }
                className={cn(
                  "flex aspect-square select-none items-center justify-center border border-gray-200 text-sm font-bold text-white transition-colors sm:text-lg",
                  onCasaClick && "cursor-pointer",
                )}
                style={{
                  backgroundColor: cor ?? "white",
                  backgroundImage: incerta ? HACHURA_INCERTA : undefined,
                  boxShadow: marcada
                    ? "inset 0 0 0 4px #2563eb"
                    : invalida
                      ? "inset 0 0 0 3px #dc2626"
                      : undefined,
                }}
              >
                {cor ? casa : incerta ? (
                  <span className="text-zinc-500">?</span>
                ) : null}
              </div>
            );
          }),
        )}
      </div>

      {sobreposicao && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-white/60 p-4 backdrop-blur-[1px]">
          {sobreposicao}
        </div>
      )}
    </div>
  );
}
