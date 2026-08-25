"use client";

import { useState } from "react";

import {
  canPlacePiece,
  getPieceCells,
  getPreviewOrigin,
  transformCells,
} from "@/lib/functions/pentominoGenerator";

import {
  BoardConfig,
  PlacedPiece,
  PentominoShape,
} from "@/lib/types/pentomino";

interface BoardProps {
  config: BoardConfig;
  placedPieces: PlacedPiece[];
  shapes: PentominoShape[];
  previewPiece?: PlacedPiece | null;
  onCellClick?: (row: number, col: number) => void;
}

export function Board({
  config,
  placedPieces,
  shapes,
  previewPiece,
  onCellClick,
}: BoardProps) {
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

  // ---------------------------------------
  // PEÇAS JÁ COLOCADAS
  // ---------------------------------------

  const cellColorMap = new Map<string, string>();

  placedPieces.forEach((piece) => {
    if (!piece.origin) return;

    const shape = shapes.find((s) => s.id === piece.shapeId);

    if (!shape) return;

    const cells = getPieceCells(shape, piece.rotation, piece.origin);

    cells.forEach(([row, col]) => {
      cellColorMap.set(`${row}-${col}`, shape.color);
    });
  });

  // ---------------------------------------
  // PREVIEW
  // ---------------------------------------

  const previewCellMap = new Map<string, string>();

  let previewValid = false;

  if (previewPiece && hoveredCell) {
    const shape = shapes.find((s) => s.id === previewPiece.shapeId);

    if (shape) {
      const transformedCells = transformCells(
        shape.cells,
        previewPiece.rotation,
      );

      const previewOrigin = getPreviewOrigin(transformedCells, hoveredCell);

      previewValid = canPlacePiece(
        shape,
        previewPiece.rotation,
        previewOrigin,
        config,
        placedPieces,
        previewPiece.instanceId,
      );

      const cells = getPieceCells(shape, previewPiece.rotation, previewOrigin);

      cells.forEach(([row, col]) => {
        // Só desenhamos células que estão
        // dentro do tabuleiro.
        if (row >= 0 && row < config.rows && col >= 0 && col < config.cols) {
          previewCellMap.set(`${row}-${col}`, shape.color);
        }
      });
    }
  }

  const previewBorder = previewValid ? "#22c55e" : "#ef4444";

  // ---------------------------------------
  // RENDER
  // ---------------------------------------

  return (
    <div
      className="grid w-fit border border-gray-200"
      style={{
        gridTemplateColumns: `repeat(${config.cols}, 60px)`,
      }}
    >
      {Array.from({ length: config.rows }).map((_, row) =>
        Array.from({
          length: config.cols,
        }).map((_, col) => {
          const key = `${row}-${col}`;

          const color = cellColorMap.get(key);

          const previewColor = previewCellMap.get(key);

          const showPreview = !color && !!previewColor;

          return (
            <div
              key={key}
              onMouseEnter={() => setHoveredCell([row, col])}
              onMouseLeave={() => setHoveredCell(null)}
              onClick={() => onCellClick?.(row, col)}
              className="h-15 w-15 cursor-pointer border border-gray-200 transition-all"
              style={{
                backgroundColor:
                  color ?? (showPreview ? previewColor : "white"),

                opacity: showPreview ? 0.45 : 1,

                boxShadow: showPreview
                  ? `inset 0 0 0 2px ${previewBorder}`
                  : undefined,
              }}
            />
          );
        }),
      )}
    </div>
  );
}
