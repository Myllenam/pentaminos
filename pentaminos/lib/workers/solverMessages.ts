import { BoardConfig, PentominoId, PlacedPiece } from "@/lib/types/pentomino";

export interface SolveRequestPiece {
  instanceId: string;
  shapeId: PentominoId;
}

export interface SolveRequest {
  type: "solve";
  requestId: number;
  config: BoardConfig;
  pieces: SolveRequestPiece[];
}

export type SolverRequest = SolveRequest;

export interface SolveSuccessResponse {
  type: "solved";
  requestId: number;
  placements: PlacedPiece[];
  elapsedMs: number;
}

export interface SolveUnsolvedResponse {
  type: "unsolved";
  requestId: number;
  elapsedMs: number;
}

export interface SolveErrorResponse {
  type: "error";
  requestId: number;
  message: string;
}

export type SolverResponse =
  | SolveSuccessResponse
  | SolveUnsolvedResponse
  | SolveErrorResponse;
