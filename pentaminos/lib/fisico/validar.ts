import { PentominoId } from "@/lib/types/pentomino";
import {
  COLUNAS_FISICO,
  LINHAS_FISICO,
  MensagemFisico,
} from "@/lib/types/fisico";

const LETRAS = "FILNPTUVWXYZ";
const CASAS_GRADE = `.?${LETRAS}`;

const STATUS_CAMERA = [
  "sintetica",
  "conectada",
  "perdida",
  "tabuleiro_detectado",
  "leitura_instavel",
];

// Comandos de outro navegador que o ws.py repassa; não mudam a tela.
const COMANDOS = new Set(["pause", "resume", "restart", "stop"]);

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function ehPeca(valor: unknown): valor is PentominoId {
  return (
    typeof valor === "string" &&
    valor.length === 1 &&
    LETRAS.includes(valor)
  );
}

function ehCasa(valor: unknown): valor is [number, number] {
  return (
    Array.isArray(valor) &&
    valor.length === 2 &&
    Number.isInteger(valor[0]) &&
    Number.isInteger(valor[1]) &&
    valor[0] >= 0 &&
    valor[0] < LINHAS_FISICO &&
    valor[1] >= 0 &&
    valor[1] < COLUNAS_FISICO
  );
}

// Lista de 6 listas de 10 casas, como em visao/pipeline.py.
function ehGrade(valor: unknown): boolean {
  return (
    Array.isArray(valor) &&
    valor.length === LINHAS_FISICO &&
    valor.every(
      (linha) =>
        Array.isArray(linha) &&
        linha.length === COLUNAS_FISICO &&
        linha.every(
          (casa) =>
            typeof casa === "string" &&
            casa.length === 1 &&
            CASAS_GRADE.includes(casa),
        ),
    )
  );
}

function motivoInvalida(dado: Registro): string | null {
  // O error do ws.py não traz session nem ts.
  if (dado.type === "error") {
    return typeof dado.detail === "string" ? null : "detail ausente";
  }

  if (typeof dado.session !== "string") {
    return "session ausente";
  }

  if (
    typeof dado.ts !== "number" ||
    !Number.isFinite(dado.ts)
  ) {
    return "ts ausente";
  }

  switch (dado.type) {
    case "board_state":
      return ehGrade(dado.grid)
        ? null
        : "grid deve ter 6 linhas de 10 casas";

    case "piece_placed":
    case "piece_removed":
      if (!ehPeca(dado.piece)) return "piece inválida";
      if (
        !Array.isArray(dado.cells) ||
        !dado.cells.every(ehCasa)
      ) {
        return "cells inválidas";
      }
      if (
        dado.sequence !== undefined &&
        !Number.isInteger(dado.sequence)
      ) {
        return "sequence deve ser inteiro";
      }
      return typeof dado.valid === "boolean"
        ? null
        : "valid deve ser booleano";

    case "camera_status":
      if (dado.detail !== undefined && typeof dado.detail !== "string") {
        return "detail deve ser texto";
      }
      return STATUS_CAMERA.includes(dado.status as string)
        ? null
        : "status da câmera inválido";

    case "game_won":
      if (
        typeof dado.tempo_total_s !== "number" ||
        typeof dado.numero_jogadas !== "number"
      ) {
        return "tempo_total_s/numero_jogadas ausentes";
      }
      return dado.grid == null || ehGrade(dado.grid)
        ? null
        : "grid deve ter 6 linhas de 10 casas";

    case "camera_error":
      return dado.detail === undefined || typeof dado.detail === "string"
        ? null
        : "detail deve ser texto";

    case "paused":
    case "resumed":
      return null;

    default:
      return `tipo desconhecido ${JSON.stringify(dado.type)}`;
  }
}

// Devolve a mensagem ou null.
export function validarMensagem(
  bruto: unknown,
): MensagemFisico | null {
  let dado = bruto;

  if (typeof dado === "string") {
    try {
      dado = JSON.parse(dado);
    } catch {
      console.warn(
        "[modo físico] mensagem ignorada: JSON inválido",
        bruto,
      );
      return null;
    }
  }

  if (!ehRegistro(dado)) {
    console.warn(
      "[modo físico] mensagem ignorada: não é um objeto",
      bruto,
    );
    return null;
  }

  if (COMANDOS.has(dado.type as string)) return null;

  const motivo = motivoInvalida(dado);

  if (motivo) {
    console.warn(
      `[modo físico] mensagem ignorada: ${motivo}`,
      dado,
    );
    return null;
  }

  return dado as unknown as MensagemFisico;
}
