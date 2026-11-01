import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EstadoFisico,
  estadoInicial,
  pecasValidas,
  reducerFisico,
  tabuleiroCompleto,
} from "@/lib/fisico/estado";
import { FonteSimulada } from "@/lib/fisico/fontes";
import { validarMensagem } from "@/lib/fisico/validar";
import { DEMO_FISICO } from "@/lib/mocks/demo-fisico";
import { MensagemFisico } from "@/lib/types/fisico";

const JSONL = resolve(
  process.cwd(),
  "backend/tests/fixtures/demo_sintetico.jsonl",
);

function lerDemo(): unknown[] {
  return readFileSync(JSONL, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((linha) => JSON.parse(linha));
}

function aplicar(
  mensagens: MensagemFisico[],
  detectarVitoriaLocal: boolean,
): EstadoFisico {
  return mensagens.reduce(
    (estado, mensagem) =>
      reducerFisico(estado, { tipo: "mensagem", mensagem }),
    estadoInicial(detectarVitoriaLocal),
  );
}

function mensagensDoDemo(): MensagemFisico[] {
  return lerDemo().map((bruta) => {
    const mensagem = validarMensagem(bruta);
    if (!mensagem) throw new Error(`linha inválida: ${JSON.stringify(bruta)}`);
    return mensagem;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("reducerFisico com demo_sintetico.jsonl", () => {
  it("todas as 29 linhas passam na validação", () => {
    expect(mensagensDoDemo()).toHaveLength(29);
  });

  it("a cópia em lib/mocks/demo-fisico.ts é igual ao .jsonl", () => {
    expect(DEMO_FISICO).toEqual(lerDemo());
  });

  it("chega à grade final do .jsonl", () => {
    const estado = aplicar(mensagensDoDemo(), true);

    expect(estado.grade).toEqual([
      "IIIIIYYYYZ",
      "VVVXWWYZZZ",
      "VNXXXWWZPP",
      "VNFXTUWUPP",
      "NNFFTUUUPL",
      "NFFTTTLLLL",
    ]);
  });

  it("guarda a ordem de colocação (I recolocada depois de L)", () => {
    const estado = aplicar(mensagensDoDemo(), true);

    expect(estado.ordemColocacao).toEqual([
      "F", "L", "I", "N", "P", "T", "U", "V", "W", "X", "Y", "Z",
    ]);
    expect(pecasValidas(estado)).toHaveLength(12);
    // Como no backend: cada piece_placed conta (13 no demo).
    expect(estado.numeroJogadas).toBe(13);
    expect(estado.eventos[0].texto).toBe("Z colocada");
    expect(estado.eventos.map((e) => e.texto)).toContain("I removida");
  });

  it("detecta a vitória só no último evento (modo simulado)", () => {
    const mensagens = mensagensDoDemo();
    const antes = aplicar(mensagens.slice(0, -1), true);
    const depois = aplicar(mensagens, true);

    expect(antes.vitoria).toBeNull();
    expect(tabuleiroCompleto(antes)).toBe(false);
    expect(depois.vitoria).toEqual({ origem: "local", numeroJogadas: 13 });
  });

  it("com WebSocket só vence ao receber game_won", () => {
    const mensagens = mensagensDoDemo();
    const semServidor = aplicar(mensagens, false);

    expect(tabuleiroCompleto(semServidor)).toBe(true);
    expect(semServidor.vitoria).toBeNull();

    const comServidor = reducerFisico(semServidor, {
      tipo: "mensagem",
      mensagem: {
        type: "game_won",
        session: "demo",
        ts: 1793141077,
        tempo_total_s: 9,
        numero_jogadas: 13,
      },
    });

    expect(comServidor.vitoria).toEqual({
      origem: "servidor",
      tempoTotalS: 9,
      numeroJogadas: 13,
    });
  });
});

describe("peças inválidas e câmera", () => {
  it("explica por que a peça é inválida", () => {
    const estado = aplicar(
      [
        {
          type: "piece_placed",
          session: "s",
          ts: 1,
          piece: "W",
          cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]],
          valid: false,
        },
      ],
      true,
    );

    expect(estado.pecas.W?.valida).toBe(false);
    expect(estado.eventos[0].texto).toBe("W inválida: forma não corresponde");
  });

  it("camera_status não apaga a grade", () => {
    const mensagens = mensagensDoDemo();
    const estado = reducerFisico(aplicar(mensagens, true), {
      tipo: "mensagem",
      mensagem: {
        type: "camera_status",
        session: "demo",
        ts: 2,
        camera: "conectada",
        tabuleiro: "perdido",
      },
    });

    expect(estado.tabuleiro).toBe("perdido");
    expect(estado.grade[0]).toBe("IIIIIYYYYZ");
  });
});

describe("validarMensagem", () => {
  it.each([
    ["JSON quebrado", "{nao é json"],
    ["tipo desconhecido", { type: "ola", session: "s", ts: 1 }],
    ["grade curta", { type: "board_state", session: "s", ts: 1, grid: ["..."] }],
    [
      "casa fora do tabuleiro",
      { type: "piece_placed", session: "s", ts: 1, piece: "F", cells: [[6, 0]], valid: true },
    ],
    [
      "peça desconhecida",
      { type: "piece_removed", session: "s", ts: 1, piece: "Q", cells: [], valid: true },
    ],
  ])("ignora %s com console.warn", (_, bruta) => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(validarMensagem(bruta)).toBeNull();
    expect(aviso).toHaveBeenCalledOnce();
  });
});

describe("FonteSimulada", () => {
  it("reproduz o demo inteiro com o id da sessão atual", () => {
    vi.useFakeTimers();

    const recebidas: MensagemFisico[] = [];
    const fonte = new FonteSimulada("abc123", 1000);
    const status = vi.fn();

    fonte.conectar((m) => recebidas.push(m), status);
    vi.advanceTimersByTime(20_000);

    expect(status).toHaveBeenCalledWith("conectada");
    // camera_status inicial + 29 linhas do demo.
    expect(recebidas).toHaveLength(30);
    expect(recebidas.every((m) => m.session === "abc123")).toBe(true);

    const final = aplicar(recebidas, true);
    expect(final.vitoria?.origem).toBe("local");

    fonte.desconectar();
  });
});
