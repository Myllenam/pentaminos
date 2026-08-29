"use client";

import { useCallback, useEffect, useRef } from "react";

import type { BoardConfig, PlacedPiece } from "@/lib/types/pentomino";
import type {
  SolveRequestPiece,
  SolverRequest,
  SolverResponse,
} from "@/lib/workers/solverMessages";

/**
 * Camada de comunicação UI ↔ Web Worker (documento de requisitos, seção 11).
 *
 * Encapsula o ciclo de vida do worker de resolução automática e expõe uma
 * função `solve()` que devolve uma Promise — assim a UI não precisa lidar
 * diretamente com `postMessage`/eventos. O worker é criado uma única vez por
 * componente e encerrado no unmount.
 */

export interface SolveOutcome {
  /** true quando o worker devolveu uma solução completa. */
  solved: boolean;
  /** peças posicionadas (origin preenchido) quando `solved`, senão null. */
  placements: PlacedPiece[] | null;
  /** tempo de execução do algoritmo, em milissegundos. */
  elapsedMs: number;
}

interface PendingRequest {
  resolve: (outcome: SolveOutcome) => void;
  reject: (error: Error) => void;
}

export function useSolverWorker() {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef<Map<number, PendingRequest>>(new Map());

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/pentominoSolver.worker.ts", import.meta.url),
    );
    workerRef.current = worker;

    const pending = pendingRef.current;

    const handleMessage = (event: MessageEvent<SolverResponse>) => {
      const mensagem = event.data;
      const requisicao = pending.get(mensagem.requestId);
      if (!requisicao) return;

      pending.delete(mensagem.requestId);

      if (mensagem.type === "error") {
        requisicao.reject(new Error(mensagem.message));
        return;
      }

      requisicao.resolve({
        solved: mensagem.type === "solved",
        placements: mensagem.type === "solved" ? mensagem.placements : null,
        elapsedMs: mensagem.elapsedMs,
      });
    };

    const handleError = (event: ErrorEvent) => {
      const erro = new Error(
        event.message || "Falha inesperada no worker de resolução.",
      );
      pending.forEach((requisicao) => requisicao.reject(erro));
      pending.clear();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      workerRef.current = null;

      const erro = new Error("Worker de resolução encerrado.");
      pending.forEach((requisicao) => requisicao.reject(erro));
      pending.clear();
    };
  }, []);

  const solve = useCallback(
    (config: BoardConfig, pieces: SolveRequestPiece[]) =>
      new Promise<SolveOutcome>((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("Worker de resolução ainda não está pronto."));
          return;
        }

        const requestId = ++requestIdRef.current;
        pendingRef.current.set(requestId, { resolve, reject });

        const request: SolverRequest = {
          type: "solve",
          requestId,
          config,
          pieces,
        };
        worker.postMessage(request);
      }),
    [],
  );

  return { solve };
}
