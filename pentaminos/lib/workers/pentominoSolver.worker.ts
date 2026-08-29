import { resolverTabuleiro } from "@/lib/functions/pentominoSolver";
import type { SolverRequest, SolverResponse } from "@/lib/workers/solverMessages";

const ctx = self as unknown as Worker;

ctx.addEventListener("message", (event: MessageEvent<SolverRequest>) => {
  const mensagem = event.data;
  if (!mensagem || mensagem.type !== "solve") return;

  const { requestId, config, pieces } = mensagem;
  const inicio =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const placements = resolverTabuleiro(config, pieces);
    const elapsedMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      inicio;

    const resposta: SolverResponse = placements
      ? { type: "solved", requestId, placements, elapsedMs }
      : { type: "unsolved", requestId, elapsedMs };

    ctx.postMessage(resposta);
  } catch (erro) {
    const resposta: SolverResponse = {
      type: "error",
      requestId,
      message:
        erro instanceof Error
          ? erro.message
          : "Erro desconhecido ao resolver o tabuleiro.",
    };
    ctx.postMessage(resposta);
  }
});
