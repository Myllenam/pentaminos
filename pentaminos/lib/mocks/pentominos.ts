import { PentominoShape } from "../types/pentomino";


export const PENTOMINOES: PentominoShape[] = [
  { id: "X", name: "X", color: "#ef4444", cells: [[0,1],[1,0],[1,1],[1,2],[2,1]] },
  { id: "W", name: "W", color: "#64748b", cells: [[0,0],[1,0],[1,1],[2,1],[2,2]] },
  { id: "V", name: "V", color: "#eab308", cells: [[0,0],[1,0],[2,0],[2,1],[2,2]] },
  { id: "Y", name: "Y", color: "#22c55e", cells: [[0,1],[1,0],[1,1],[2,1],[3,1]] },
  { id: "L", name: "L", color: "#f97316", cells: [[0,0],[1,0],[2,0],[3,0],[3,1]] },
  { id: "U", name: "U", color: "#a855f7", cells: [[0,0],[0,2],[1,0],[1,1],[1,2]] },
  { id: "F", name: "F", color: "#06b6d4", cells: [[0,1],[0,2],[1,0],[1,1],[2,1]] },
  { id: "I", name: "I", color: "#3b82f6", cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },
  { id: "N", name: "N", color: "#ec4899", cells: [[0,1],[1,1],[2,0],[2,1],[3,0]] },
  { id: "P", name: "P", color: "#14b8a6", cells: [[0,0],[0,1],[1,0],[1,1],[2,0]] },
  { id: "T", name: "T", color: "#8b5cf6", cells: [[0,0],[0,1],[0,2],[1,1],[2,1]] },
  { id: "Z", name: "Z", color: "#f43f5e", cells: [[0,0],[0,1],[1,1],[2,1],[2,2]] },
];

// Gera um "jogo" mockado com N peças (2 a 12), pra simular o estado inicial da tela
export function getMockGamePieces(count: number = 6) {
  const shuffled = [...PENTOMINOES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(Math.max(count, 2), 12)).map((shape, i) => ({
    instanceId: `piece-${i}`,
    shapeId: shape.id,
    rotation: 0 as const,
    mirrored: false,
    origin: null,
  }));
}

export const MOCK_BOARD_CONFIG = { rows: 5, cols: 6 };