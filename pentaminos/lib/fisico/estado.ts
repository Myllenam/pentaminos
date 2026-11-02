import { motivoPecaInvalida } from "@/lib/fisico/forma";
import { Cell, PentominoId } from "@/lib/types/pentomino";
import {
  AtribuirPeca,
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
  numeroJogadas: number; // como no backend: peça válida em posição nova
  ultimasPosicoes: Partial<Record<PentominoId, string>>; // última posição válida
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
  | { tipo: "atribuir"; atribuicao: AtribuirPeca } // modo simulado: aplica direto
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
    ultimasPosicoes: {},
    camera: null,
    duvidas: [],
    cameraDetalhe: null,
    erro: null,
    vitoria: null,
    detectarVitoriaLocal,
  };
}

function chavePosicao(casas: Cell[]): string {
  return casas.map(([r, c]) => `${r},${c}`).sort().join(";");
}

function gradeEmTexto(grid: GradeVisao): string[] {
  return grid.map((linha) => linha.join(""));
}

// Peças inválidas agrupadas pelo motivo.
export function invalidasPorMotivo(
  estado: EstadoFisico,
): { motivo: string; pecas: PentominoId[] }[] {
  const grupos = new Map<string, PentominoId[]>();

  for (const [letra, peca] of Object.entries(estado.pecas)) {
    if (peca.valida) continue;
    const motivo = peca.motivo ?? "peça inválida";
    grupos.set(motivo, [...(grupos.get(motivo) ?? []), letra as PentominoId]);
  }

  return [...grupos]
    .map(([motivo, pecas]) => ({ motivo, pecas: pecas.sort() }))
    .sort((a, b) => a.motivo.localeCompare(b.motivo));
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
      const posicao = chavePosicao(cells);
      const conta = valid && estado.ultimasPosicoes[piece] !== posicao;

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
        numeroJogadas: estado.numeroJogadas + (conta ? 1 : 0),
        ultimasPosicoes: valid
          ? { ...estado.ultimasPosicoes, [piece]: posicao }
          : estado.ultimasPosicoes,
        eventos: novoEvento(estado, {
          ts: mensagem.ts,
          peca: piece,
          tipo: valid ? "colocada" : "invalida",
          texto: !valid
            ? `${piece} inválida: ${motivo}`
            : mensagem.manual
              ? `${piece} definida pelo jogador`
              : `${piece} colocada`,
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

// Sem visão: grava a peça e manda um piece_placed manual.
function aplicarAtribuicao(
  estado: EstadoFisico,
  { cells, piece }: AtribuirPeca,
): EstadoFisico {
  const marcadas = new Set(cells.map(([r, c]) => `${r},${c}`));
  const toca = (casas: Cell[]) => casas.some(([r, c]) => marcadas.has(`${r},${c}`));
  const grade = estado.grade.map((linha) => [...linha]);
  const pecas = { ...estado.pecas };

  for (const [letra, peca] of Object.entries(pecas)) {
    if (letra === piece || (!peca.valida && toca(peca.casas))) {
      peca.casas.forEach(([r, c]) => (grade[r][c] = letra === piece ? "." : "?"));
      delete pecas[letra as PentominoId];
    }
  }
  cells.forEach(([r, c]) => (grade[r][c] = piece));

  return aplicarMensagem(
    {
      ...estado,
      grade: grade.map((linha) => linha.join("")),
      pecas,
      duvidas: estado.duvidas.filter((d) => !toca(d.cells)),
    },
    { type: "piece_placed", session: "local", ts: Math.floor(Date.now() / 1000),
      piece, cells, valid: true, manual: true },
  );
}

export function reducerFisico(
  estado: EstadoFisico,
  acao: AcaoFisico,
): EstadoFisico {
  if (acao.tipo === "reiniciar") {
    return estadoInicial(acao.detectarVitoriaLocal);
  }

  const proximo =
    acao.tipo === "atribuir"
      ? aplicarAtribuicao(estado, acao.atribuicao)
      : aplicarMensagem(estado, acao.mensagem);

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
