export type Cell = [row: number, col: number];

export type PentominoId =
  | "F" | "I" | "L" | "N" | "P" | "T"
  | "U" | "V" | "W" | "X" | "Y" | "Z";

export interface PentominoShape {
  id: PentominoId;
  name: string;
  color: string;      // cor de destaque (hex ou classe tailwind)
  cells: Cell[];       // formato base, normalizado a partir de (0,0)
}

export interface PlacedPiece {
  instanceId: string;   // uuid da instância no board (permite repetir peças)
  shapeId: PentominoId;
  rotation: 0 | 90 | 180 | 270;
  mirrored: boolean;
  origin: Cell | null;   // posição de ancoragem no board, null = ainda não posicionada
}

export interface BoardConfig {
  rows: number;
  cols: number;
}