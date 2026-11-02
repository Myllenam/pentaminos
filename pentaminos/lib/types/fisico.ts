import { Cell, PentominoId } from "./pentomino";

// Mensagens do WebSocket (docs/contrato-websocket.md).

export const LINHAS_FISICO = 6;
export const COLUNAS_FISICO = 10;
export const TOTAL_PECAS_FISICO = 12;

// "." = vazio, "?" = incerto, letra = peça.
export type CasaGrade = PentominoId | "." | "?";

// 6 linhas de 10 casas, como sai de visao/pipeline.py.
export type GradeVisao = CasaGrade[][];

// Mensagens da visão (loop_ao_vivo.py), repassadas pelo ws.py.
interface MensagemVisao {
  session: string;
  ts: number; // segundos (epoch)
}

// Peça que a visão não reconheceu; a tela pergunta ao jogador.
export interface Duvida {
  cells: Cell[];
  candidatas: PentominoId[];
}

export interface MensagemBoardState extends MensagemVisao {
  type: "board_state";
  grid: GradeVisao;
  duvidas?: Duvida[];
}

export interface MensagemPeca extends MensagemVisao {
  type: "piece_placed" | "piece_removed";
  piece: PentominoId;
  cells: Cell[];
  valid: boolean;
  sequence?: number; // acrescentado pelo ws.py depois de gravar a jogada
}

export type StatusCamera =
  | "sintetica"
  | "conectada"
  | "perdida"
  | "tabuleiro_detectado"
  | "leitura_instavel"; // quadros descartados há mais de ~3 s

export interface MensagemCameraStatus extends MensagemVisao {
  type: "camera_status";
  status: StatusCamera;
  detail?: string; // motivo, em leitura_instavel
}

export interface MensagemGameWon extends MensagemVisao {
  type: "game_won";
  // O ws.py troca pelos valores salvos no banco.
  tempo_total_s: number;
  numero_jogadas: number;
  grid?: GradeVisao | null;
}

export interface MensagemCameraError extends MensagemVisao {
  type: "camera_error";
  detail?: string;
}

export interface MensagemPausa extends MensagemVisao {
  type: "paused" | "resumed";
}

// Do próprio ws.py, só para quem mandou a mensagem recusada.
export interface MensagemErro {
  type: "error";
  detail: string;
}

export type MensagemFisico =
  | MensagemBoardState
  | MensagemPeca
  | MensagemCameraStatus
  | MensagemGameWon
  | MensagemCameraError
  | MensagemPausa
  | MensagemErro;

// Comandos do navegador; o ws.py repassa aos outros clientes da sala.
export type ComandoFisico = "pause" | "resume" | "restart" | "stop";

// Peça nomeada pelo jogador numa dúvida.
export interface AtribuirPeca {
  type: "assign_piece";
  cells: Cell[];
  piece: PentominoId;
}

export type MensagemNavegador = ComandoFisico | AtribuirPeca;

export type StatusConexao =
  | "conectando"
  | "conectada"
  | "desconectada";
