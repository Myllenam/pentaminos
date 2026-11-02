import { motivoPecaInvalida } from "@/lib/fisico/forma";
import { Cell, PentominoId } from "@/lib/types/pentomino";
import {
  COLUNAS_FISICO,
  LINHAS_FISICO,
  Duvida,
  GradeVisao,
  MensagemFisico,
  StatusCamera,
  TOTAL_PECAS_FISICO,
} from "@/lib/types/fisico";

export interface PecaFisica {
  casas: Cell[];
  valida: boolean;
  motivo?: string; // só quando inválida
}

export interface EventoFisico {
  id: number;
  ts?: number; // o error do ws.py vem sem ts
  peca?: PentominoId;
  tipo: "colocada" | "removida" | "invalida" | "erro" | "pausa";
  texto: string;
}

export interface VitoriaFisica {
  origem: "servidor" | "local";
  tempoTotalS?: number; // só quando vem do servidor
  numeroJogadas: number;
}

export interface EstadoFisico {
  grade: string[];
  pecas: Partial<Record<PentominoId, PecaFisica>>;
  // Ordem de colocação.
  ordemColocacao: PentominoId[];
  eventos: EventoFisico[]; // mais recente primeiro
  numeroJogadas: number; // como no backend: soma 1 a cada piece_placed
  camera: StatusCamera | null; // null = nunca informado
  duvidas: Duvida[]; // peças que a visão pergunta ao jogador
  cameraDetalhe: string | null; // motivo da leitura instável
  erro: string | null; // último error/camera_error
  vitoria: VitoriaFisica | null;
  // Modo simulado: sem game_won.
  detectarVitoriaLocal: boolean;
}

export type AcaoFisico =
  | { tipo: "mensagem"; mensagem: MensagemFisico }
  | { tipo: "reiniciar"; detectarVitoriaLocal: boolean };

export const MAX_EVENTOS = 50;

const GRADE_VAZIA = Array.from({ length: LINHAS_FISICO }, () =>
  ".".repeat(COLUNAS_FISICO),
);

export function estadoInicial(
  detectarVitoriaLocal: boolean,
): EstadoFisico {
  return {
    grade: GRADE_VAZIA,
    pecas: {},
    ordemColocacao: [],
    eventos: [],
    numeroJogadas: 0,
    camera: null,
    duvidas: [],
    cameraDetalhe: null,
    erro: null,
    vitoria: null,
    detectarVitoriaLocal,
  };
}

function gradeEmTexto(grid: GradeVisao): string[] {
  return grid.map((linha) => linha.join(""));
}

export function casasPreenchidas(grade: string[]): number {
  return grade.join("").replace(/[.?]/g, "").length;
}

export function pecasValidas(
  estado: EstadoFisico,
): PentominoId[] {
  return estado.ordemColocacao.filter(
    (peca) => estado.pecas[peca]?.valida,
  );
}

// Grade cheia e 12 peças válidas.
export function tabuleiroCompleto(estado: EstadoFisico): boolean {
  return (
    casasPreenchidas(estado.grade) ===
      LINHAS_FISICO * COLUNAS_FISICO &&
    pecasValidas(estado).length === TOTAL_PECAS_FISICO
  );
}

function novoEvento(
  estado: EstadoFisico,
  evento: Omit<EventoFisico, "id">,
): EventoFisico[] {
  const id = (estado.eventos[0]?.id ?? 0) + 1;

  return [{ id, ...evento }, ...estado.eventos].slice(
    0,
    MAX_EVENTOS,
  );
}

function aplicarMensagem(
  estado: EstadoFisico,
  mensagem: MensagemFisico,
): EstadoFisico {
  switch (mensagem.type) {
    case "board_state":
      return {
        ...estado,
        grade: gradeEmTexto(mensagem.grid),
        duvidas: mensagem.duvidas ?? [],
      };

    case "piece_placed": {
      const { piece, cells, valid } = mensagem;
      const motivo = valid
        ? undefined
        : motivoPecaInvalida(piece, cells);

      return {
        ...estado,
        pecas: {
          ...estado.pecas,
          [piece]: { casas: cells, valida: valid, motivo },
        },
        ordemColocacao: [
          ...estado.ordemColocacao.filter((p) => p !== piece),
          piece,
        ],
        numeroJogadas: estado.numeroJogadas + 1,
        eventos: novoEvento(estado, {
          ts: mensagem.ts,
          peca: piece,
          tipo: valid ? "colocada" : "invalida",
          texto: valid
            ? `${piece} colocada`
            : `${piece} inválida: ${motivo}`,
        }),
      };
    }

    case "piece_removed": {
      const { piece } = mensagem;
      const pecas = { ...estado.pecas };
      delete pecas[piece];

      return {
        ...estado,
        pecas,
        ordemColocacao: estado.ordemColocacao.filter(
          (p) => p !== piece,
        ),
        eventos: novoEvento(estado, {
          ts: mensagem.ts,
          peca: piece,
          tipo: "removida",
          texto: `${piece} removida`,
        }),
      };
    }

    case "camera_status":
      return { ...estado, camera: mensagem.status, cameraDetalhe: mensagem.detail ?? null };

    case "error":
    case "camera_error": {
      const texto =
        mensagem.type === "error"
          ? mensagem.detail
          : `Câmera: ${mensagem.detail ?? "erro sem detalhe"}`;

      return {
        ...estado,
        erro: texto,
        eventos: novoEvento(estado, {
          ts: mensagem.type === "error" ? undefined : mensagem.ts,
          tipo: "erro",
          texto,
        }),
      };
    }

    case "paused":
    case "resumed":
      return {
        ...estado,
        eventos: novoEvento(estado, {
          ts: mensagem.ts,
          tipo: "pausa",
          texto:
            mensagem.type === "paused" ? "Visão pausada" : "Visão retomada",
        }),
      };

    case "game_won":
      return {
        ...estado,
        grade: mensagem.grid ? gradeEmTexto(mensagem.grid) : estado.grade,
        vitoria: {
          origem: "servidor",
          tempoTotalS: mensagem.tempo_total_s,
          numeroJogadas: mensagem.numero_jogadas,
        },
      };
  }
}

export function reducerFisico(
  estado: EstadoFisico,
  acao: AcaoFisico,
): EstadoFisico {
  if (acao.tipo === "reiniciar") {
    return estadoInicial(acao.detectarVitoriaLocal);
  }

  const proximo = aplicarMensagem(estado, acao.mensagem);

  if (
    !proximo.vitoria &&
    proximo.detectarVitoriaLocal &&
    tabuleiroCompleto(proximo)
  ) {
    return {
      ...proximo,
      vitoria: {
        origem: "local",
        numeroJogadas: proximo.numeroJogadas,
      },
    };
  }

  return proximo;
}
