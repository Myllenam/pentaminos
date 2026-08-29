import { resolverTabuleiro } from "@/lib/functions/pentominoSolver";
import type { SolverRequest, SolverResponse } from "@/lib/workers/solverMessages";

/**
 * Web Worker de resolução automática (documento de requisitos, seção 11).
 *
 * Roda o backtracking com poda numa thread separada, para que os "milhares de
 * tentativas de encaixe" não travem a renderização do React durante a
 * execução. Recebe um `SolverRequest`, devolve um `SolverResponse`.
 */

// Dentro de um Web Worker, `self` é o escopo global. O lib "dom" do tsconfig já
// o tipa como um EventTarget com `postMessage`/`addEventListener("message")`,
// então basta um cast para termos os tipos corretos sem puxar o lib "webworker".
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
