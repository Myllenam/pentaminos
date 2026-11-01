import { Cell, PentominoId } from "./pentomino";

// Contrato das mensagens do modo físico.
// board_state / piece_placed / piece_removed: geradas por visao/pipeline.py.
// camera_status / game_won: virão do servidor (Atividade 7).

export const LINHAS_FISICO = 6;
export const COLUNAS_FISICO = 10;
export const TOTAL_PECAS_FISICO = 12;

// "." = vazio, "?" = incerto, letra = peça.
export type CasaGrade = PentominoId | "." | "?";

interface MensagemBase {
  session: string;
  ts: number; // segundos (epoch)
}

export interface MensagemBoardState extends MensagemBase {
  type: "board_state";
  grid: string[]; // 6 strings de 10 caracteres
}

export interface MensagemPeca extends MensagemBase {
  type: "piece_placed" | "piece_removed";
  piece: PentominoId;
  cells: Cell[];
  valid: boolean;
}

export interface MensagemCameraStatus extends MensagemBase {
  type: "camera_status";
  camera: "conectada" | "desconectada";
  tabuleiro: "detectado" | "perdido";
}

export interface MensagemGameWon extends MensagemBase {
  type: "game_won";
  tempo_total_s: number;
  numero_jogadas: number;
}

export type MensagemFisico =
  | MensagemBoardState
  | MensagemPeca
  | MensagemCameraStatus
  | MensagemGameWon;

export type StatusConexao =
  | "conectando"
  | "conectada"
  | "desconectada";
