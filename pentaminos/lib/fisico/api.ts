import { TOTAL_PECAS_FISICO } from "@/lib/types/fisico";
import { PentominoId } from "@/lib/types/pentomino";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TEMPO_LIMITE_MS = 5000;

// Sessão sem backend.
const PREFIXO_LOCAL = "local-";

export function criarSessaoLocal(): string {
  return `${PREFIXO_LOCAL}${Math.random().toString(16).slice(2, 14)}`;
}

export function ehSessaoLocal(sessaoId: string): boolean {
  return sessaoId.startsWith(PREFIXO_LOCAL);
}

// Campos de JogadaOut e SessaoOut em backend/app/schemas.py.
export interface JogadaServidor {
  sequencia: number;
  tipo: "piece_placed" | "piece_removed";
  peca: PentominoId;
  valida: boolean;
}

export interface SessaoServidor {
  id: string;
  jogador: string;
  status: "em_andamento" | "vencida" | "abandonada";
  tempo_total_s: number | null;
  numero_jogadas: number;
}

export interface SessaoDetalheServidor extends SessaoServidor {
  jogadas: JogadaServidor[];
}

async function requisitar<T>(
  caminho: string,
  metodo: "GET" | "POST",
  corpo?: unknown,
): Promise<T> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(`${API_URL}${caminho}`, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controle.signal,
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null);
      throw new Error(
        erro?.detail
          ? String(erro.detail)
          : `O servidor respondeu ${resposta.status}.`,
      );
    }

    return (await resposta.json()) as T;
  } catch (erro) {
    if (erro instanceof Error && erro.name === "AbortError") {
      throw new Error("O servidor não respondeu a tempo.");
    }
    if (erro instanceof TypeError) {
      throw new Error(`Não foi possível conectar ao servidor (${API_URL}).`);
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

function postar<T>(caminho: string, corpo?: unknown): Promise<T> {
  return requisitar<T>(caminho, "POST", corpo);
}

export async function criarSessaoFisica(jogador: string): Promise<string> {
  const sessao = await postar<{ id: string }>("/sessions", {
    jogador,
    modo: "fisico",
    pecas: TOTAL_PECAS_FISICO,
  });

  return sessao.id;
}

export async function abandonarSessao(sessaoId: string): Promise<void> {
  await postar(`/sessions/${encodeURIComponent(sessaoId)}/abandon`);
}

export async function finalizarSessao(
  sessaoId: string,
  grade: string[],
): Promise<void> {
  // "?" vira null.
  const tabuleiroFinal = grade.map((linha) =>
    [...linha].map((casa) => (casa === "?" ? null : casa)),
  );

  await postar(`/sessions/${encodeURIComponent(sessaoId)}/finish`, {
    tabuleiro_final: tabuleiroFinal,
  });
}

export function buscarSessao(
  sessaoId: string,
): Promise<SessaoDetalheServidor> {
  return requisitar(`/sessions/${encodeURIComponent(sessaoId)}`, "GET");
}

// 10 melhores partidas físicas vencidas: menor tempo, depois menos jogadas.
export async function listarRankingFisico(): Promise<SessaoServidor[]> {
  const params = new URLSearchParams({
    modo: "fisico",
    status: "vencida",
    pecas: String(TOTAL_PECAS_FISICO),
  });
  const sessoes = await requisitar<SessaoServidor[]>(
    `/sessions?${params.toString()}`,
    "GET",
  );

  return [...sessoes]
    .sort(
      (a, b) =>
        (a.tempo_total_s ?? Infinity) - (b.tempo_total_s ?? Infinity) ||
        a.numero_jogadas - b.numero_jogadas,
    )
    .slice(0, 10);
}

// Ordem final de colocação, refazendo as jogadas por sequencia.
export function ordemDasJogadas(jogadas: JogadaServidor[]): PentominoId[] {
  const ordem: PentominoId[] = [];

  for (const jogada of [...jogadas].sort((a, b) => a.sequencia - b.sequencia)) {
    const indice = ordem.indexOf(jogada.peca);
    if (indice !== -1) ordem.splice(indice, 1);
    if (jogada.tipo === "piece_placed") ordem.push(jogada.peca);
  }

  return ordem;
}
