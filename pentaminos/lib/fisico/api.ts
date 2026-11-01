import { TOTAL_PECAS_FISICO } from "@/lib/types/fisico";

// Rotas de backend/README.md (POST /sessions, /finish, /abandon).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TEMPO_LIMITE_MS = 5000;

// Sessões sem backend ("Jogar em modo simulado") usam este prefixo.
const PREFIXO_LOCAL = "local-";

export function criarSessaoLocal(): string {
  return `${PREFIXO_LOCAL}${Math.random().toString(16).slice(2, 14)}`;
}

export function ehSessaoLocal(sessaoId: string): boolean {
  return sessaoId.startsWith(PREFIXO_LOCAL);
}

async function postar<T>(caminho: string, corpo?: unknown): Promise<T> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(`${API_URL}${caminho}`, {
      method: "POST",
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
  // O backend aceita letra, "." ou null; "?" vira null.
  const tabuleiroFinal = grade.map((linha) =>
    [...linha].map((casa) => (casa === "?" ? null : casa)),
  );

  await postar(`/sessions/${encodeURIComponent(sessaoId)}/finish`, {
    tabuleiro_final: tabuleiroFinal,
  });
}
