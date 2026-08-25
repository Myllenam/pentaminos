"use client";

import { BoardConfig, PlacedPiece, PentominoShape } from "@/lib/types/pentomino";


interface BoardProps {
  config: BoardConfig;
  placedPieces: PlacedPiece[];
  shapes: PentominoShape[];
  onCellClick?: (row: number, col: number) => void;
}

export function Board({ config, placedPieces, shapes, onCellClick }: BoardProps) {
  // mapa célula -> cor, calculado a partir das peças já posicionadas
  const cellColorMap = new Map<string, string>();

  placedPieces.forEach((piece) => {
    if (!piece.origin) return;
    const shape = shapes.find((s) => s.id === piece.shapeId);
    if (!shape) return;

    shape.cells.forEach(([r, c]) => {
      const row = piece.origin![0] + r;
      const col = piece.origin![1] + c;
      cellColorMap.set(`${row}-${col}`, shape.color);
    });
  });

  return (
    <div
      className="grid border border-gray-200 w-fit"
      style={{ gridTemplateColumns: `repeat(${config.cols}, 60px)` }}
    >
      {Array.from({ length: config.rows }).map((_, row) =>
        Array.from({ length: config.cols }).map((_, col) => {
          const color = cellColorMap.get(`${row}-${col}`);
          return (
            <div
              key={`${row}-${col}`}
              onClick={() => onCellClick?.(row, col)}
              className="w-15 h-15 border border-gray-200 cursor-pointer"
              style={{ backgroundColor: color ?? "white" }}
            />
          );
        })
      )}
    </div>
  );
}