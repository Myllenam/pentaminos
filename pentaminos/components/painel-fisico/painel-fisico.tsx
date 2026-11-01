import {
  AlertTriangle,
  Camera,
  CameraOff,
  Loader2,
  MinusCircle,
  PlusCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { ReactNode } from "react";

import { EstadoFisico, EventoFisico } from "@/lib/fisico/estado";
import { TipoFonte } from "@/lib/fisico/fontes";
import { PENTOMINOES } from "@/lib/mocks/pentominos";
import { StatusConexao } from "@/lib/types/fisico";
import { cn } from "@/lib/utils";

type Tom = "ok" | "alerta" | "erro" | "neutro";

const TONS: Record<Tom, string> = {
  ok: "bg-green-50 text-green-700 ring-green-200",
  alerta: "bg-amber-50 text-amber-700 ring-amber-200",
  erro: "bg-red-50 text-red-700 ring-red-200",
  neutro: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

function Indicador({
  tom,
  icone,
  children,
}: {
  tom: Tom;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 [&_svg]:size-3.5",
        TONS[tom],
      )}
    >
      {icone}
      {children}
    </span>
  );
}

export function IndicadorConexao({
  fonte,
  conexao,
  reconectando,
}: {
  fonte: TipoFonte;
  conexao: StatusConexao;
  reconectando: boolean;
}) {
  if (fonte === "simulada") {
    return (
      <Indicador tom="neutro" icone={<Wifi />}>
        Modo simulado
      </Indicador>
    );
  }

  if (conexao === "conectada") {
    return (
      <Indicador tom="ok" icone={<Wifi />}>
        Conectado
      </Indicador>
    );
  }

  if (conexao === "conectando") {
    return (
      <Indicador
        tom={reconectando ? "alerta" : "neutro"}
        icone={<Loader2 className="animate-spin" />}
      >
        {reconectando ? "Reconectando…" : "Conectando…"}
      </Indicador>
    );
  }

  return (
    <Indicador tom="erro" icone={<WifiOff />}>
      Desconectado
    </Indicador>
  );
}

export function IndicadorCamera({
  camera,
  tabuleiro,
}: Pick<EstadoFisico, "camera" | "tabuleiro">) {
  if (camera === "desconectada") {
    return (
      <Indicador tom="erro" icone={<CameraOff />}>
        Câmera desconectada
      </Indicador>
    );
  }

  if (tabuleiro === "perdido") {
    return (
      <Indicador tom="alerta" icone={<AlertTriangle />}>
        Tabuleiro perdido
      </Indicador>
    );
  }

  if (camera === "conectada") {
    return (
      <Indicador tom="ok" icone={<Camera />}>
        Câmera conectada
      </Indicador>
    );
  }

  return (
    <Indicador tom="neutro" icone={<Camera />}>
      Câmera: aguardando
    </Indicador>
  );
}

export function PecasFisicas({ estado }: { estado: EstadoFisico }) {
  return (
    <div className="w-full rounded-md border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <p className="mb-3 text-xs font-bold tracking-wide text-foreground">
        PEÇAS
      </p>

      <div className="grid grid-cols-6 gap-2">
        {PENTOMINOES.map((shape) => {
          const peca = estado.pecas[shape.id];
          const invalida = peca && !peca.valida;

          return (
            <span
              key={shape.id}
              title={
                !peca
                  ? `${shape.id}: fora do tabuleiro`
                  : invalida
                    ? `${shape.id}: ${peca.motivo}`
                    : `${shape.id}: colocada`
              }
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-sm font-bold",
                peca ? "text-white" : "bg-zinc-100 text-zinc-400",
                invalida && "ring-2 ring-red-600 ring-offset-1",
              )}
              style={peca ? { backgroundColor: shape.color } : undefined}
            >
              {shape.id}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function formatarHora(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("pt-BR");
}

const ICONE_EVENTO: Record<EventoFisico["tipo"], ReactNode> = {
  colocada: <PlusCircle className="size-4 text-green-600" />,
  removida: <MinusCircle className="size-4 text-zinc-500" />,
  invalida: <AlertTriangle className="size-4 text-red-600" />,
};

export function ListaEventos({
  eventos,
  limite = 12,
}: {
  eventos: EventoFisico[];
  limite?: number;
}) {
  return (
    <div className="w-full rounded-md border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <p className="mb-3 text-xs font-bold tracking-wide text-foreground">
        ÚLTIMOS EVENTOS
      </p>

      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma jogada ainda. Coloque uma peça no tabuleiro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {eventos.slice(0, limite).map((evento) => (
            <li
              key={evento.id}
              className={cn(
                "flex items-center gap-2 text-sm",
                evento.tipo === "invalida" && "font-medium text-red-700",
              )}
            >
              {ICONE_EVENTO[evento.tipo]}
              <span className="flex-1">{evento.texto}</span>
              <span className="font-cousine text-xs text-muted-foreground">
                {formatarHora(evento.ts)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OrdemColocacao({ ordem }: { ordem: string[] }) {
  return (
    <ol className="flex flex-wrap justify-center gap-1.5">
      {ordem.map((peca, indice) => (
        <li
          key={peca}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-white"
          style={{
            backgroundColor: PENTOMINOES.find((s) => s.id === peca)?.color,
          }}
        >
          <span className="opacity-75">{indice + 1}.</span>
          {peca}
        </li>
      ))}
    </ol>
  );
}
