import { RotateCw } from "lucide-react";

export function ComoJogar() {
  return (
    <div className="w-full max-w-xs bg-white rounded-2xl shadow-md shadow-slate-200/70 p-5">
      <h3 className="text-xs font-bold tracking-wide text-slate-800 mb-4">
        COMO JOGAR
      </h3>

      <ol className="space-y-3.5">
        <li className="flex items-start gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full border-2 border-indigo-500 text-indigo-600 text-[11px] font-bold flex items-center justify-center mt-0.5">
            1
          </span>
          <p className="text-sm text-slate-600 leading-snug">
            Clique em uma peça para selecioná-la.
          </p>
        </li>

        <li className="flex items-start gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full border-2 border-indigo-500 text-indigo-600 text-[11px] font-bold flex items-center justify-center mt-0.5">
            2
          </span>
          <p className="text-sm text-slate-600 leading-snug">
            Use{" "}
            <RotateCw className="inline w-3.5 h-3.5 text-indigo-500 -mt-0.5 mx-0.5" />{" "}
            Girar para mudar a orientação.
          </p>
        </li>

        <li className="flex items-start gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full border-2 border-indigo-500 text-indigo-600 text-[11px] font-bold flex items-center justify-center mt-0.5">
            3
          </span>
          <p className="text-sm text-slate-600 leading-snug">
            Clique no tabuleiro para posicionar.
          </p>
        </li>

        <li className="flex items-start gap-3">
          <span className="shrink-0 w-5 h-5 rounded-full border-2 border-indigo-500 text-indigo-600 text-[11px] font-bold flex items-center justify-center mt-0.5">
            4
          </span>
          <p className="text-sm text-slate-600 leading-snug">
            Clique em uma peça no board para removê-la.
          </p>
        </li>
      </ol>
    </div>
  );
}
