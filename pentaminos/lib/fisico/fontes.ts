import { validarMensagem } from "@/lib/fisico/validar";
import { DEMO_FISICO } from "@/lib/mocks/demo-fisico";
import {
  MensagemFisico,
  StatusConexao,
} from "@/lib/types/fisico";

export type TipoFonte = "websocket" | "simulada";

export type OnMensagem = (mensagem: MensagemFisico) => void;
export type OnStatus = (status: StatusConexao) => void;

export interface FonteEventos {
  readonly tipo: TipoFonte;
  conectar(onMensagem: OnMensagem, onStatus: OnStatus): void;
  desconectar(): void;
}

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

const ESPERA_MAXIMA_MS = 10_000;

/**
 * Conecta em {WS_URL}/ws/sessions/{id}. Se cair, tenta de novo com
 * espera crescente: 1 s, 2 s, 4 s, 8 s, 10 s, 10 s...
 */
export class FonteWebSocket implements FonteEventos {
  readonly tipo = "websocket";

  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tentativas = 0;
  private ativa = false;

  constructor(
    private readonly sessaoId: string,
    private readonly baseUrl: string = WS_URL,
  ) {}

  conectar(onMensagem: OnMensagem, onStatus: OnStatus) {
    this.ativa = true;
    this.abrir(onMensagem, onStatus);
  }

  desconectar() {
    this.ativa = false;

    if (this.timer) clearTimeout(this.timer);
    this.timer = null;

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
    }
    this.socket = null;
  }

  private abrir(onMensagem: OnMensagem, onStatus: OnStatus) {
    onStatus("conectando");

    const url = `${this.baseUrl}/ws/sessions/${encodeURIComponent(this.sessaoId)}`;
    let socket: WebSocket;

    try {
      socket = new WebSocket(url);
    } catch (erro) {
      console.warn("[modo físico] URL de WebSocket inválida", url, erro);
      this.agendar(onMensagem, onStatus);
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      this.tentativas = 0;
      onStatus("conectada");
    };

    socket.onmessage = (evento) => {
      const mensagem = validarMensagem(evento.data);
      if (mensagem) onMensagem(mensagem);
    };

    // onerror sempre vem seguido de onclose; a reconexão fica lá.
    socket.onclose = () => {
      this.socket = null;
      this.agendar(onMensagem, onStatus);
    };
  }

  private agendar(onMensagem: OnMensagem, onStatus: OnStatus) {
    if (!this.ativa) return;

    onStatus("desconectada");

    const espera = Math.min(
      1000 * 2 ** this.tentativas,
      ESPERA_MAXIMA_MS,
    );
    this.tentativas += 1;

    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.ativa) this.abrir(onMensagem, onStatus);
    }, espera);
  }
}

/**
 * Reproduz demo_sintetico.jsonl trocando "session" pelo id atual.
 * A cada intervalo emite um board_state junto com os eventos de peça
 * que vêm logo depois dele (como o pipeline faz num mesmo quadro).
 */
export class FonteSimulada implements FonteEventos {
  readonly tipo = "simulada";

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly sessaoId: string,
    private readonly intervaloMs: number = 1000,
    private readonly mensagens: readonly unknown[] = DEMO_FISICO,
  ) {}

  conectar(onMensagem: OnMensagem, onStatus: OnStatus) {
    this.desconectar();

    const lotes = this.agruparPorQuadro();
    let proximo = 0;

    onStatus("conectada");
    // A demo não tem camera_status; simulamos uma câmera ok.
    onMensagem({
      type: "camera_status",
      session: this.sessaoId,
      ts: Math.floor(Date.now() / 1000),
      camera: "conectada",
      tabuleiro: "detectado",
    });

    this.timer = setInterval(() => {
      const lote = lotes[proximo++];

      if (!lote) {
        this.desconectar();
        return;
      }

      lote.forEach(onMensagem);
    }, this.intervaloMs);
  }

  desconectar() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private agruparPorQuadro(): MensagemFisico[][] {
    const lotes: MensagemFisico[][] = [];

    for (const bruta of this.mensagens) {
      const mensagem = validarMensagem(
        typeof bruta === "object" && bruta !== null
          ? { ...bruta, session: this.sessaoId }
          : bruta,
      );

      if (!mensagem) continue;

      if (mensagem.type === "board_state" || lotes.length === 0) {
        lotes.push([mensagem]);
      } else {
        lotes[lotes.length - 1].push(mensagem);
      }
    }

    return lotes;
  }
}
