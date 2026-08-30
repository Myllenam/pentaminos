"use client";

import { useState } from "react";

import { gerarTabuleiro } from "@/lib/functions/pentominoGenerator";
import { useSolverWorker } from "@/lib/hooks/useSolverWorker";

export default function TesteWorker() {
  const { solve } = useSolverWorker();
  const [log, setLog] = useState<string[]>([]);
  const [contador, setContador] = useState(0);
  const [resolvendo, setResolvendo] = useState(false);

  const add = (linha: string) =>
    setLog((atual) => [...atual, `${new Date().toLocaleTimeString()}  ${linha}`]);

  const rodar = async (n: number) => {
    setResolvendo(true);
    const board = gerarTabuleiro(n);
    const pieces = board.availablePieces.map((p) => ({
      instanceId: p.instanceId,
      shapeId: p.shapeId,
    }));

    add(`-> solve(${n} peças, ${board.config.rows}x${board.config.cols})`);

    try {
      const outcome = await solve(board.config, pieces);
      add(
        `<- solved=${outcome.solved} placements=${outcome.placements?.length ?? 0} ` +
          `worker=${outcome.elapsedMs.toFixed(0)}ms`,
      );
    } catch (erro) {
      add(`<- ERRO: ${(erro as Error).message}`);
    } finally {
      setResolvendo(false);
    }
  };

  const rodarImpossivel = async () => {
    setResolvendo(true);
    add("-> solve(config incompatível)");
    try {
      const outcome = await solve({ rows: 3, cols: 3 }, [
        { instanceId: "x-0", shapeId: "X" },
      ]);
      add(`<- solved=${outcome.solved} (esperado: false)`);
    } catch (erro) {
      add(`<- ERRO: ${(erro as Error).message}`);
    } finally {
      setResolvendo(false);
    }
  };

  const botaoBase =
    "rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const botaoPrimario = `${botaoBase} bg-indigo-600 text-white hover:bg-indigo-500`;
  const botaoNeutro = `${botaoBase} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100`;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-bold text-zinc-900">
        Teste do Worker de resolução
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Exercita o hook <code className="font-mono">useSolverWorker</code> sem
        depender da UI do jogo.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {[3, 6, 9, 12].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => rodar(n)}
            disabled={resolvendo}
            className={botaoPrimario}
          >
            {resolvendo ? "resolvendo…" : `solve ${n}`}
          </button>
        ))}
        <button
          type="button"
          onClick={rodarImpossivel}
          disabled={resolvendo}
          className={botaoNeutro}
        >
          caso sem solução
        </button>
        <button
          type="button"
          onClick={() => setLog([])}
          className={botaoNeutro}
        >
          limpar log
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
        <span>
          Contador (a thread principal não pode travar durante o solve):{" "}
          <b className="font-mono">{contador}</b>
        </span>
        <button
          type="button"
          onClick={() => setContador((c) => c + 1)}
          className={botaoNeutro}
        >
          +1
        </button>
      </div>

      <pre className="mt-6 min-h-[220px] overflow-auto rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-emerald-400">
        {log.length === 0 ? "(sem eventos ainda)" : log.join("\n")}
      </pre>
    </div>
  );
}
