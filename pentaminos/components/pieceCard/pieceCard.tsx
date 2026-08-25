"use client";

import { PentominoShape } from "@/lib/types/pentomino";



interface PieceCardProps {
  shape: PentominoShape;
  selected?: boolean;
  onSelect?: () => void;
}

export function PieceCard({ shape, selected, onSelect }: PieceCardProps) {
  const maxRow = Math.max(...shape.cells.map((c) => c[0])) + 1;
  const maxCol = Math.max(...shape.cells.map((c) => c[1])) + 1;

  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 w-full p-3 rounded-lg border ${
        selected ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
      }`}
    >
      <span
        className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: shape.color }}
      >
        {shape.id}
      </span>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${maxCol}, 8px)` }}
      >
        {Array.from({ length: maxRow * maxCol }).map((_, idx) => {
          const r = Math.floor(idx / maxCol);
          const c = idx % maxCol;
          const filled = shape.cells.some(([cr, cc]) => cr === r && cc === c);
          return (
            <div
              key={idx}
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: filled ? shape.color : "transparent" }}
            />
          );
        })}
      </div>
    </button>
  );
}