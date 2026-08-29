import { BoardConfig, PentominoId, PlacedPiece } from "@/lib/types/pentomino";

/**
 * Contrato de mensagens trocadas entre a UI (thread principal do React) e o
 * Web Worker que roda o algoritmo de resolução automática (seção 11 do
 * documento de requisitos — "Processamento pesado → Web Workers").
 *
 * A comunicação é sempre por `postMessage`, com um `requestId` numérico que
 * permite casar cada resposta com a chamada que a originou (necessário porque
 * o jogador pode acionar "Resolver Automaticamente" mais de uma vez).
 */

/** Peça enviada ao worker: só o essencial para o backtracking. */
export interface SolveRequestPiece {
  instanceId: string;
  shapeId: PentominoId;
}

/** UI → Worker: pedido para resolver o tabuleiro vazio com o conjunto fixo de peças. */
export interface SolveRequest {
  type: "solve";
  requestId: number;
  config: BoardConfig;
  pieces: SolveRequestPiece[];
}

/** Todas as mensagens que a UI pode enviar ao worker. */
export type SolverRequest = SolveRequest;

/** Worker → UI: solução encontrada, com as peças já posicionadas (origin preenchido). */
export interface SolveSuccessResponse {
  type: "solved";
  requestId: number;
  placements: PlacedPiece[];
  /** Tempo gasto pelo algoritmo, em milissegundos (útil para telemetria/RNF07). */
  elapsedMs: number;
}

/** Worker → UI: nenhuma solução encontrada dentro do limite de busca (situação excepcional — MSG10). */
export interface SolveUnsolvedResponse {
  type: "unsolved";
  requestId: number;
  elapsedMs: number;
}

/** Worker → UI: erro inesperado durante a execução do algoritmo. */
export interface SolveErrorResponse {
  type: "error";
  requestId: number;
  message: string;
}

/** Todas as mensagens que o worker pode devolver à UI. */
export type SolverResponse =
  | SolveSuccessResponse
  | SolveUnsolvedResponse
  | SolveErrorResponse;
