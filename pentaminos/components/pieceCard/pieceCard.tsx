"use client";

import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { PlacedPiece } from "@/lib/types/pentomino";
import { transformCells } from "@/lib/functions/pentominoGenerator";

interface PieceCardProps {
  piece: PlacedPiece;
  selected?: boolean;
  onSelect?: () => void;
  onRotate?: () => void;
}

export function PieceCard({
  piece,
  selected,
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
      className={`flex items-center gap-3 w-full p-3 rounded-lg border ${
        selected
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-3"
      >
        <span
          className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
          style={{
            backgroundColor: shape.color,
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
                    ? shape.color
                    : "transparent",
                }}
              />
            );
          })}
        </div>
      </button>

      <button
        type="button"
        onClick={onRotate}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-lg hover:bg-gray-200"
        aria-label="Girar peça"
      >
        ↻
      </button>
    </div>
  );
}
