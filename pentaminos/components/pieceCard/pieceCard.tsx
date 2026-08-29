"use client";

import { Check } from "lucide-react";

import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { PlacedPiece } from "@/lib/types/pentomino";
import { transformCells } from "@/lib/functions/pentominoGenerator";
import { cn } from "@/lib/utils";

interface PieceCardProps {
  piece: PlacedPiece;
  selected?: boolean;
  placed?: boolean;
  onSelect?: () => void;
  onRotate?: () => void;
}

export function PieceCard({
  piece,
  selected,
  placed,
  onSelect,
  onRotate,
}: PieceCardProps) {
  const shape = PENTOMINOES.find(
    (s) => s.id === piece.shapeId,
  );

  if (!shape) return null;

  const cells = transformCells(
    shape.cells,
    piece.rotation,
  );

  const maxRow =
    Math.max(...cells.map(([r]) => r)) + 1;

  const maxCol =
    Math.max(...cells.map(([, c]) => c)) + 1;

  return (
    <div
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-lg border",
        placed
          ? "border-gray-200 bg-gray-50"
          : selected
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-200",
      )}
    >
      <button
        type="button"
        onClick={placed ? undefined : onSelect}
        disabled={placed}
        className={cn(
          "flex flex-1 items-center gap-3",
          placed ? "cursor-default opacity-40" : "cursor-pointer",
        )}
      >
        <span
          className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
          style={{
            backgroundColor: placed ? "#9ca3af" : shape.color,
          }}
        >
          {shape.id}
        </span>

        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${maxCol}, 8px)`,
          }}
        >
          {Array.from({
            length: maxRow * maxCol,
          }).map((_, idx) => {
            const r = Math.floor(idx / maxCol);
            const c = idx % maxCol;

            const filled = cells.some(
              ([cr, cc]) => cr === r && cc === c,
            );

            return (
              <div
                key={idx}
                className="h-2 w-2 rounded-sm"
                style={{
                  backgroundColor: filled
                    ? placed
                      ? "#9ca3af"
                      : shape.color
                    : "transparent",
                }}
              />
            );
          })}
        </div>
      </button>

      {placed ? (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 text-green-600"
          aria-label="Peça posicionada"
        >
          <Check className="size-4" />
        </span>
      ) : (
        <button
          type="button"
          onClick={onRotate}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-lg hover:bg-gray-200"
          aria-label="Girar peça"
        >
          ↻
        </button>
      )}
    </div>
  );
}
