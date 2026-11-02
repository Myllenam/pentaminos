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
import { JogadaServidor, ordemDasJogadas } from "@/lib/fisico/api";
import { alternarCasa, montarAtribuicao } from "@/lib/fisico/duvida";
import { FonteSimulada, FonteWebSocket } from "@/lib/fisico/fontes";
import { validarMensagem } from "@/lib/fisico/validar";
import { DEMO_FISICO } from "@/lib/mocks/demo-fisico";
import { MensagemFisico } from "@/lib/types/fisico";

const JSONL = resolve(
  process.cwd(),
  "backend/tests/fixtures/demo_sintetico.jsonl",
);

// Grade do .jsonl vira lista de listas, como no conftest.py.
function lerDemo(): unknown[] {
  return readFileSync(JSONL, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((linha) => {
      const mensagem = JSON.parse(linha);
      if (mensagem.type === "board_state") {
        mensagem.grid = mensagem.grid.map((l: string) => [...l]);
      }
      return mensagem;
    });
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
    // 13 piece_placed no demo; a I volta ao mesmo lugar e não conta.
    expect(estado.numeroJogadas).toBe(12);
    expect(estado.eventos[0].texto).toBe("Z colocada");
    expect(estado.eventos.map((e) => e.texto)).toContain("I removida");
  });

  it("detecta a vitória só no último evento (modo simulado)", () => {
    const mensagens = mensagensDoDemo();
    const antes = aplicar(mensagens.slice(0, -1), true);
    const depois = aplicar(mensagens, true);

    expect(antes.vitoria).toBeNull();
    expect(tabuleiroCompleto(antes)).toBe(false);
    expect(depois.vitoria).toEqual({ origem: "local", numeroJogadas: 12 });
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
        status: "perdida",
      },
    });

    expect(estado.camera).toBe("perdida");
    expect(estado.grade[0]).toBe("IIIIIYYYYZ");
  });
});

// Mensagens do contrato (docs/contrato-websocket.md).
describe("contrato do WebSocket", () => {
  const gradeVisao = [
    ["I", "I", "I", "I", "I", ".", ".", ".", ".", "."],
    ...Array.from({ length: 5 }, () => Array(10).fill(".")),
  ];

  function receber(bruta: unknown, estado = estadoInicial(false)) {
    const mensagem = validarMensagem(bruta);
    if (!mensagem) throw new Error(`recusada: ${JSON.stringify(bruta)}`);
    return reducerFisico(estado, { tipo: "mensagem", mensagem });
  }

  it("board_state com grade em lista de listas", () => {
    const estado = receber(
      JSON.stringify({ type: "board_state", session: "s", ts: 5, grid: gradeVisao }),
    );

    expect(estado.grade).toEqual(["IIIII.....", ...Array(5).fill("..........")]);
  });

  it.each(["sintetica", "conectada", "perdida", "tabuleiro_detectado"])(
    "camera_status %s",
    (status) => {
      expect(receber({ type: "camera_status", session: "s", ts: 1, status }).camera)
        .toBe(status);
    },
  );

  it("leitura_instavel guarda o motivo e volta com tabuleiro_detectado", () => {
    const instavel = receber({
      type: "camera_status",
      session: "s",
      ts: 1,
      status: "leitura_instavel",
      detail: "movimento entre quadros (12.0)",
    });
    expect(instavel.camera).toBe("leitura_instavel");
    expect(instavel.cameraDetalhe).toBe("movimento entre quadros (12.0)");

    const voltou = receber({ type: "camera_status", session: "s", ts: 2, status: "tabuleiro_detectado" }, instavel);
    expect(voltou.camera).toBe("tabuleiro_detectado");
    expect(voltou.cameraDetalhe).toBeNull();
  });

  it("game_won com a grade final", () => {
    const estado = receber({
      type: "game_won",
      session: "s",
      ts: 9,
      tempo_total_s: 42,
      numero_jogadas: 12,
      grid: gradeVisao,
    });

    expect(estado.vitoria).toEqual({ origem: "servidor", tempoTotalS: 42, numeroJogadas: 12 });
    expect(estado.grade[0]).toBe("IIIII.....");
  });

  it("game_won sem grid mantém a grade", () => {
    const antes = receber({ type: "board_state", session: "s", ts: 5, grid: gradeVisao });
    const depois = receber(
      { type: "game_won", session: "s", ts: 9, tempo_total_s: 1, numero_jogadas: 1, grid: null },
      antes,
    );

    expect(depois.grade).toEqual(antes.grade);
  });

  it("piece_placed com sequence do ws.py", () => {
    expect(
      validarMensagem({
        type: "piece_placed",
        session: "s",
        ts: 1,
        piece: "I",
        cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
        valid: true,
        sequence: 1,
      }),
    ).toMatchObject({ piece: "I", sequence: 1 });
  });

  it("error do ws.py vai para o aviso e para a lista de eventos", () => {
    const estado = receber({ type: "error", detail: "Sessão encerrada." });

    expect(estado.erro).toBe("Sessão encerrada.");
    expect(estado.eventos[0]).toMatchObject({ tipo: "erro", texto: "Sessão encerrada." });
    expect(estado.eventos[0].ts).toBeUndefined();
  });

  it("camera_error vira erro", () => {
    const estado = receber({ type: "camera_error", session: "s", ts: 3, detail: "sem imagem" });

    expect(estado.erro).toBe("Câmera: sem imagem");
  });

  it("paused e resumed entram na lista de eventos", () => {
    const pausado = receber({ type: "paused", session: "s", ts: 1 });
    const retomado = receber({ type: "resumed", session: "s", ts: 2 }, pausado);

    expect(retomado.eventos.map((e) => e.texto)).toEqual(["Visão retomada", "Visão pausada"]);
  });

  it.each(["pause", "resume", "restart", "stop"])(
    "ignora o comando %s repassado sem avisar",
    (type) => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(validarMensagem({ type, session: "s" })).toBeNull();
      expect(aviso).not.toHaveBeenCalled();
    },
  );
});

describe("validarMensagem", () => {
  it.each([
    ["JSON quebrado", "{nao é json"],
    ["tipo desconhecido", { type: "ola", session: "s", ts: 1 }],
    ["camera_status sem ts", { type: "camera_status", session: "s", status: "conectada" }],
    ["camera_status antigo", { type: "camera_status", session: "s", ts: 1, camera: "conectada" }],
    ["grade curta", { type: "board_state", session: "s", ts: 1, grid: [["."]] }],
    [
      "grade em strings",
      { type: "board_state", session: "s", ts: 1, grid: Array(6).fill("..........") },
    ],
    ["game_won sem ts", { type: "game_won", session: "s", tempo_total_s: 1, numero_jogadas: 1 }],
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
    // camera_status + 29 linhas.
    expect(recebidas).toHaveLength(30);
    expect(recebidas.every((m) => "session" in m && m.session === "abc123")).toBe(true);

    const final = aplicar(recebidas, true);
    expect(final.vitoria?.origem).toBe("local");

    fonte.desconectar();
  });

  it("pause para a reprodução e resume continua", () => {
    vi.useFakeTimers();

    const recebidas: MensagemFisico[] = [];
    const fonte = new FonteSimulada("abc123", 1000);

    fonte.conectar((m) => recebidas.push(m), () => {});
    vi.advanceTimersByTime(1000);
    const antes = recebidas.length;

    fonte.enviar("pause");
    vi.advanceTimersByTime(5000);
    expect(recebidas).toHaveLength(antes);

    fonte.enviar("resume");
    vi.advanceTimersByTime(1000);
    expect(recebidas.length).toBeGreaterThan(antes);

    fonte.desconectar();
  });
});

describe("ordemDasJogadas (GET /sessions/{id})", () => {
  it("refaz as jogadas: peça removida e recolocada vai para o fim", () => {
    const jogadas: JogadaServidor[] = [
      { sequencia: 3, tipo: "piece_removed", peca: "I", valida: true },
      { sequencia: 1, tipo: "piece_placed", peca: "I", valida: true },
      { sequencia: 2, tipo: "piece_placed", peca: "F", valida: true },
      { sequencia: 4, tipo: "piece_placed", peca: "I", valida: true },
      { sequencia: 5, tipo: "piece_placed", peca: "L", valida: true },
      { sequencia: 6, tipo: "piece_removed", peca: "L", valida: true },
    ];

    expect(ordemDasJogadas(jogadas)).toEqual(["F", "I"]);
  });
});

describe("dúvida da visão e resposta do jogador", () => {
  const vazia = Array.from({ length: 6 }, () => Array(10).fill("."));
  const V: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]];
  const duvida = { cells: V, candidatas: ["V", "Z"] };

  it("board_state com duvidas vai para o estado e some no próximo sem duvidas", () => {
    const com = validarMensagem({ type: "board_state", session: "s", ts: 1, grid: vazia, duvidas: [duvida] });
    const estado = reducerFisico(estadoInicial(false), { tipo: "mensagem", mensagem: com! });
    expect(estado.duvidas).toEqual([duvida]);

    const sem = validarMensagem({ type: "board_state", session: "s", ts: 2, grid: vazia });
    expect(reducerFisico(estado, { tipo: "mensagem", mensagem: sem! }).duvidas).toEqual([]);
  });

  it("duvidas malformadas são ignoradas com console.warn", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ruim = { type: "board_state", session: "s", ts: 1, grid: vazia, duvidas: [{ cells: [[9, 9]], candidatas: ["V"] }] };
    expect(validarMensagem(ruim)).toBeNull();
    expect(aviso).toHaveBeenCalledOnce();
  });

  it("tocar numa casa liga e desliga a seleção", () => {
    const menos = alternarCasa(V, [2, 2]);
    expect(menos).toHaveLength(4);
    expect(alternarCasa(menos, [2, 2])).toHaveLength(5);
  });

  it("só monta a resposta se a seleção formar a peça escolhida", () => {
    expect(montarAtribuicao(V, "V")).toEqual({ type: "assign_piece", cells: V, piece: "V" });
    expect(montarAtribuicao(V, "Z")).toBe(
      "As casas marcadas não formam a peça Z. Toque nas casas para ajustar.",
    );
    expect(typeof montarAtribuicao(V.slice(0, 4), "V")).toBe("string");
  });

  it("FonteWebSocket envia o assign_piece com a sessão", () => {
    const enviados: string[] = [];
    class SocketFalso {
      static OPEN = 1;
      readyState = 1;
      onopen: (() => void) | null = null;
      onmessage = null;
      onclose = null;
      constructor() { setTimeout(() => this.onopen?.(), 0); }
      send(dado: string) { enviados.push(dado); }
      close() {}
    }
    vi.stubGlobal("WebSocket", SocketFalso);
    const fonte = new FonteWebSocket("abc", "ws://teste");
    fonte.conectar(() => {}, () => {});
    fonte.enviar({ type: "assign_piece", cells: V, piece: "V" });
    fonte.enviar("pause");
    fonte.desconectar();
    vi.unstubAllGlobals();
    expect(enviados.map((e) => JSON.parse(e))).toEqual([
      { type: "assign_piece", cells: V, piece: "V", session: "abc" },
      { type: "pause", session: "abc" },
    ]);
  });
});

describe("contagem de jogadas", () => {
  const F: [number, number][] = [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]];
  const peca = (tipo: "piece_placed" | "piece_removed", cells: [number, number][], valid = true) =>
    ({ type: tipo, session: "s", ts: 1, piece: "F", cells, valid }) as MensagemFisico;

  it("só conta peça válida em posição nova", () => {
    const movida = F.map(([r, c]) => [r, c + 4] as [number, number]);
    const passos = [
      peca("piece_placed", F, false),   // inválida: não conta
      peca("piece_placed", F),          // 1
      peca("piece_removed", F),
      peca("piece_placed", F),          // pisca e volta: não conta
      peca("piece_placed", movida),     // 2
    ];
    const contagens = passos.reduce<{ estado: EstadoFisico; n: number[] }>(
      ({ estado, n }, mensagem) => {
        const proximo = reducerFisico(estado, { tipo: "mensagem", mensagem });
        return { estado: proximo, n: [...n, proximo.numeroJogadas] };
      },
      { estado: estadoInicial(false), n: [] },
    ).n;
    expect(contagens).toEqual([0, 1, 1, 1, 2]);
  });
});
