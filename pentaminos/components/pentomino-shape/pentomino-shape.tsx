import { cn } from "@/lib/utils";

const SHAPES = {
  plus: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ],
  t: [
    [1, 1, 1],
    [0, 1, 0],
    [0, 1, 0],
  ],
  z: [
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 1],
  ],
  l: [
    [1, 0],
    [1, 0],
    [1, 0],
    [1, 1],
  ],
} as const;

export interface PentominoShapeProps {
  shape?: keyof typeof SHAPES;
  colorClassName?: string;
  cellSize?: number;
  className?: string;
}

export function PentominoShape({
  shape = "plus",
  colorClassName = "bg-primary",
  cellSize = 20,
  className,
}: PentominoShapeProps) {
  const matrix = SHAPES[shape];

  return (
    <div
      className={cn("grid gap-1", className)}
      style={{
        gridTemplateColumns: `repeat(${matrix[0].length}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${matrix.length}, ${cellSize}px)`,
      }}
    >
      {matrix.flatMap((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <span
            key={`${rowIndex}-${colIndex}`}
            className={cn("rounded-[3px]", cell ? colorClassName : "bg-transparent")}
          />
        ))
      )}
    </div>
  );
}