"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CameraOff,
  Info,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";

import { Alert } from "@/components/alert/alert";
import { BoardFisico } from "@/components/board-fisico/board-fisico";
import { Logo } from "@/components/logo/logo";
import {
  IndicadorCamera,
  IndicadorConexao,
  ListaEventos,
  OrdemColocacao,
  PecasFisicas,
} from "@/components/painel-fisico/painel-fisico";
import { Progresso } from "@/components/progresso/progresso";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  abandonarSessao,
  buscarSessao,
  criarSessaoFisica,
  criarSessaoLocal,
  ehSessaoLocal,
  finalizarSessao,
  listarRankingFisico,
  ordemDasJogadas,
  SessaoServidor,
} from "@/lib/fisico/api";
import {
  alternarCasa,
  chaveCasa,
  duvidaAtual,
  montarAtribuicao,
  motivoSelecao,
  outrasLetras,
} from "@/lib/fisico/duvida";
import {
  casasPreenchidas,
  invalidasPorMotivo,
  pecasValidas,
} from "@/lib/fisico/estado";
import { TipoFonte } from "@/lib/fisico/fontes";
import { useJogoFisico } from "@/lib/hooks/useJogoFisico";
import { formatElapsedTime } from "@/lib/ranking";
import { cn } from "@/lib/utils";
import {
  COLUNAS_FISICO,
  LINHAS_FISICO,
  TOTAL_PECAS_FISICO,
} from "@/lib/types/fisico";
import { Cell, PentominoId } from "@/lib/types/pentomino";

type Salvamento = "nao_se_aplica" | "salvando" | "salvo" | "erro";

// O que GET /sessions/{id} e o ranking devolvem depois da vitória.
type ResultadoServidor =
  | { tipo: "ok"; ordem: PentominoId[]; ranking: SessaoServidor[] }
  | { tipo: "erro" };

const COMANDOS_VISAO = [
  { rotulo: "Sem câmera (fonte sintética)", fonte: "sintetica" },
  { rotulo: "Câmera real (webcam 0 ou URL do celular)", fonte: "0" },
];

interface TelaFisicoProps {
  sessaoId: string;
  jogador: string;
  fontePreferida: TipoFonte;
  intervaloMs: number;
}

function TelaFisico({
  sessaoId,
  jogador,
  fontePreferida,
  intervaloMs,
}: TelaFisicoProps) {
  const router = useRouter();
  const sessaoLocal = ehSessaoLocal(sessaoId);

  const {
    estado,
    venceu,
    conexao,
    reconectando,
    fonteAtiva,
    caiuParaSimulado,
    enviar,
  } = useJogoFisico(sessaoId, fontePreferida, {
      intervaloSimuladoMs: intervaloMs,
    });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [vitoriaFechada, setVitoriaFechada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Dúvida mostrada (uma de cada vez) e o ajuste do jogador nela.
  const [duvidaId, setDuvidaId] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<{
    chave: string;
    casas: Cell[];
    escolhida: PentominoId | null;
    outras: boolean;
    aviso: string | null;
  } | null>(null);

  const atual = duvidaAtual(estado.duvidas, duvidaId);
  const duvida = atual?.duvida ?? null;
  const chaveDuvida = duvida
    ? `${duvida.id}:${duvida.cells.map(chaveCasa).join(";")}`
    : "";
  const ajusteAtual = ajuste?.chave === chaveDuvida ? ajuste : null;
  const selecao = ajusteAtual?.casas ?? duvida?.cells ?? [];
  const escolhida = ajusteAtual?.escolhida ?? null;
  const motivoNaoConfirma = escolhida ? motivoSelecao(selecao, escolhida) : null;

  const mudarAjuste = (parcial: Partial<NonNullable<typeof ajuste>>) =>
    setAjuste({
      chave: chaveDuvida,
      casas: selecao,
      escolhida,
      outras: ajusteAtual?.outras ?? false,
      aviso: null,
      ...parcial,
    });

  const confirmarDuvida = () => {
    if (!escolhida) return;
    const atribuicao = montarAtribuicao(selecao, escolhida);
    if (typeof atribuicao === "string") return;
    enviar(atribuicao);
    mudarAjuste({ aviso: `Enviado: ${escolhida}. Aguardando a câmera confirmar.` });
  };
  const [salvamento, setSalvamento] =
    useState<Salvamento>("nao_se_aplica");
  const [resultado, setResultado] = useState<ResultadoServidor | null>(null);

  const finalizouRef = useRef(false);

  const isRunning = !pausado && !venceu;

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Só no simulado: com WebSocket o servidor finaliza.
  useEffect(() => {
    if (
      !venceu ||
      fonteAtiva !== "simulada" ||
      sessaoLocal ||
      finalizouRef.current
    ) {
      return;
    }

    finalizouRef.current = true;

    const salvar = async () => {
      setSalvamento("salvando");
      try {
        await finalizarSessao(sessaoId, estado.grade);
        setSalvamento("salvo");
      } catch (falha) {
        console.warn("[modo físico] falha ao finalizar sessão", falha);
        setSalvamento("erro");
      }
    };

    void salvar();
  }, [venceu, fonteAtiva, sessaoLocal, sessaoId, estado.grade]);

  // Com WebSocket o ws.py já finalizou; no simulado, espera o /finish.
  const resultadoPronto =
    venceu &&
    !sessaoLocal &&
    (fonteAtiva === "websocket" || salvamento === "salvo");

  useEffect(() => {
    if (!resultadoPronto) return;

    let cancelado = false;

    Promise.all([buscarSessao(sessaoId), listarRankingFisico()])
      .then(([sessao, ranking]) => {
        if (cancelado) return;
        setResultado({ tipo: "ok", ordem: ordemDasJogadas(sessao.jogadas), ranking });
      })
      .catch((falha) => {
        console.warn("[modo físico] falha ao buscar o resultado", falha);
        if (!cancelado) setResultado({ tipo: "erro" });
      });

    return () => {
      cancelado = true;
    };
  }, [resultadoPronto, sessaoId]);

  const invalidas = useMemo(
    () =>
      new Set(
        Object.entries(estado.pecas)
          .filter(([, peca]) => !peca.valida)
          .map(([letra]) => letra),
      ),
    [estado.pecas],
  );

  const validas = pecasValidas(estado);
  const preenchidas = casasPreenchidas(estado.grade);
  const tempoFinal = estado.vitoria?.tempoTotalS ?? elapsedSeconds;

  const cameraPerdida =
    estado.camera === "perdida" || estado.camera === "leitura_instavel";

  const comandoVisao = (fonte: string) =>
    `cd visao
python loop_ao_vivo.py --fonte ${fonte} --sessao ${sessaoId}`;

  const alternarPausa = () => {
    enviar(pausado ? "resume" : "pause");
    setPausado((atual) => !atual);
  };

  // Encerra o loop_ao_vivo.py antes de abandonar a sessão.
  const abandonarSePreciso = async () => {
    enviar("stop");
    if (sessaoLocal || venceu) return;

    try {
      await abandonarSessao(sessaoId);
    } catch (falha) {
      console.warn("[modo físico] falha ao abandonar sessão", falha);
    }
  };

  const handleRestart = async () => {
    setOcupado(true);
    setErro(null);

    try {
      await abandonarSePreciso();

      const novaSessao = sessaoLocal
        ? criarSessaoLocal()
        : await criarSessaoFisica(jogador);

      const params = new URLSearchParams({
        sessao: novaSessao,
        nome: jogador,
      });
      if (fonteAtiva === "simulada") params.set("fonte", "simulada");
      if (intervaloMs !== 1000) params.set("intervalo", String(intervaloMs));

      router.replace(`/jogar-fisico?${params.toString()}`);
    } catch (falha) {
      setErro(
        `Não foi possível criar uma nova sessão. ${
          falha instanceof Error ? falha.message : ""
        }`,
      );
      setOcupado(false);
    }
  };

  const handleExit = async () => {
    setOcupado(true);
    await abandonarSePreciso();
    router.push("/");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-50">
      <header className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight text-foreground">
            PENTAMINÓS
          </span>
          <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground sm:inline">
            Tabuleiro físico
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IndicadorConexao
            fonte={fonteAtiva}
            conexao={conexao}
            reconectando={reconectando}
          />
          <IndicadorCamera camera={estado.camera} />
        </div>

        <div className="flex w-full gap-2 sm:w-auto [&>button]:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button
            variant="outline"
            onClick={alternarPausa}
            disabled={venceu}
          >
            {pausado ? (
              <Play data-icon="inline-start" />
            ) : (
              <Pause data-icon="inline-start" />
            )}
            {pausado ? "Continuar" : "Pausar"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setRestartOpen(true)}
            disabled={ocupado}
          >
            <RotateCcw data-icon="inline-start" />
            Reiniciar
          </Button>
          <Button variant="destructive" onClick={handleExit} disabled={ocupado}>
            <LogOut data-icon="inline-start" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8 lg:py-10">
        <section className="flex flex-1 flex-col items-center gap-4">
          {fonteAtiva === "simulada" && (
            <div className="flex w-full max-w-[640px] items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Modo simulado.</strong>{" "}
                {caiuParaSimulado
                  ? "Não foi possível conectar ao servidor em tempo real; exibindo uma partida de demonstração."
                  : "Exibindo uma partida de demonstração gravada da câmera."}
              </span>
            </div>
          )}

          {estado.erro && (
            <div
              role="alert"
              className="flex w-full max-w-[640px] items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Servidor: {estado.erro}</span>
            </div>
          )}

          {erro && (
            <div className="flex w-full max-w-[640px] items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {duvida && atual && (
            <div
              role="status"
              className="flex w-full max-w-[640px] flex-col gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 ring-1 ring-blue-200"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">
                  Não consegui reconhecer esta peça. Qual é?
                </p>
                {estado.duvidas.length > 1 && (
                  <span className="flex items-center gap-2 text-xs">
                    {atual.contagem}
                    <Button size="sm" variant="ghost" onClick={() => setDuvidaId(atual.proxima)}>
                      Próxima
                    </Button>
                  </span>
                )}
              </div>
              <p className="text-xs">
                As casas com contorno azul são as da peça; toque no tabuleiro para ajustar.
              </p>
              <div className="flex flex-wrap gap-2">
                {duvida.candidatas.map((peca) => (
                  <Button
                    key={peca}
                    size="sm"
                    variant={escolhida === peca ? "default" : "outline"}
                    onClick={() => mudarAjuste({ escolhida: peca })}
                  >
                    {peca}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => mudarAjuste({ outras: !ajusteAtual?.outras })}
                >
                  Outra
                </Button>
              </div>
              {ajusteAtual?.outras && (
                <div className="flex flex-wrap gap-1">
                  {outrasLetras(pecasValidas(estado), duvida.candidatas).map((peca) => (
                    <Button
                      key={peca}
                      size="sm"
                      variant={escolhida === peca ? "default" : "outline"}
                      onClick={() => mudarAjuste({ escolhida: peca })}
                    >
                      {peca}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!escolhida || motivoNaoConfirma !== null}
                  onClick={confirmarDuvida}
                >
                  Confirmar
                </Button>
                {motivoNaoConfirma && <p className="text-xs">{motivoNaoConfirma}</p>}
              </div>
              {ajusteAtual?.aviso && <p className="text-xs">{ajusteAtual.aviso}</p>}
            </div>
          )}

          <BoardFisico
            grade={estado.grade}
            pecasInvalidas={invalidas}
            selecionadas={duvida ? new Set(selecao.map(chaveCasa)) : undefined}
            onCasaClick={
              duvida
                ? (linha, coluna) =>
                    mudarAjuste({ casas: alternarCasa(selecao, [linha, coluna]) })
                : undefined
            }
            sobreposicao={
              cameraPerdida ? (
                <div className="flex max-w-xs flex-col items-center gap-2 rounded-lg bg-white px-5 py-4 text-center shadow-lg ring-1 ring-amber-200">
                  <CameraOff className="size-6 text-amber-600" />
                  <p className="font-semibold text-foreground">
                    {estado.camera === "perdida"
                      ? "Câmera perdida"
                      : "Leitura instável"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {estado.camera === "leitura_instavel" && estado.cameraDetalhe
                      ? `${estado.cameraDetalhe}. `
                      : ""}
                    Mostrando a última leitura. Verifique a câmera, a luz e se
                    o tabuleiro está inteiro no campo de visão.
                  </p>
                </div>
              ) : null
            }
          />

          {invalidas.size > 0 && (
            <ul className="flex w-full max-w-[640px] flex-col gap-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {invalidasPorMotivo(estado).map(({ motivo, pecas }) => (
                <li key={motivo} className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  {pecas.length > 1 ? "Peças" : "Peça"} {pecas.join(", ")}: {motivo}
                </li>
              ))}
            </ul>
          )}

          <p className="text-center text-xs text-muted-foreground">
            O tabuleiro acima espelha o tabuleiro físico lido pela câmera
            ({LINHAS_FISICO}×{COLUNAS_FISICO}).
          </p>
        </section>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
          <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col">
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                JOGADOR
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {jogador}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                JOGADAS
              </span>
              <span className="text-sm font-bold text-foreground">
                {estado.numeroJogadas}
              </span>
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-medium tracking-wide text-muted-foreground">
                  TEMPO
                </span>
                <span className="font-cousine text-2xl font-bold text-primary">
                  {formatElapsedTime(tempoFinal)}
                </span>
              </div>
              {pausado && !venceu && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                  Pausado
                </span>
              )}
            </div>
          </div>

          <Progresso
            celulasPreenchidas={preenchidas}
            totalCelulas={LINHAS_FISICO * COLUNAS_FISICO}
            pecasRestantes={TOTAL_PECAS_FISICO - validas.length}
          />

          <PecasFisicas estado={estado} />

          <ListaEventos eventos={estado.eventos} />

          {fonteAtiva === "websocket" && (
            <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                SERVIÇO DE VISÃO
              </span>
              <p className="text-xs text-muted-foreground">
                Rode um dos comandos em outro terminal, na pasta do projeto.
                Para o celular, troque <code>0</code> pela URL do aplicativo
                de câmera.
              </p>
              {COMANDOS_VISAO.map(({ rotulo, fonte }) => (
                <div key={fonte} className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground">
                    {rotulo}
                  </span>
                  <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-white">
                    {comandoVisao(fonte)}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void navigator.clipboard?.writeText(comandoVisao(fonte))
                    }
                  >
                    Copiar comando
                  </Button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </main>

      <Alert
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title="Reiniciar partida?"
        description="A sessão atual será abandonada e uma nova será criada. Retire as peças do tabuleiro físico para começar de novo."
        confirmLabel="Reiniciar"
        variant="destructive-solid"
        onConfirm={handleRestart}
      />

      <Dialog
        open={venceu && !vitoriaFechada}
        onOpenChange={(aberto) => setVitoriaFechada(!aberto)}
      >
        <DialogContent>
          <DialogHeader className="flex-col items-center pr-0 text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              <Trophy className="size-5 text-warning" />
              Tabuleiro completo!
            </DialogTitle>
            <DialogDescription>
              Parabéns, {jogador}! As {TOTAL_PECAS_FISICO} peças foram
              encaixadas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md bg-zinc-50 p-3">
              <p className="text-xs text-muted-foreground">TEMPO</p>
              <p className="font-cousine text-xl font-bold text-primary">
                {formatElapsedTime(tempoFinal)}
              </p>
            </div>
            <div className="rounded-md bg-zinc-50 p-3">
              <p className="text-xs text-muted-foreground">JOGADAS</p>
              <p className="text-xl font-bold text-foreground">
                {estado.vitoria?.numeroJogadas ?? estado.numeroJogadas}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-center text-xs font-semibold text-muted-foreground">
              ORDEM DE COLOCAÇÃO
            </p>
            <OrdemColocacao
              ordem={
                resultado?.tipo === "ok" ? resultado.ordem : estado.ordemColocacao
              }
            />
            {resultado?.tipo === "ok" && (
              <p className="text-center text-xs text-muted-foreground">
                Registrada no servidor.
              </p>
            )}
          </div>

          {resultado?.tipo === "ok" && (
            <div className="flex flex-col gap-2">
              <p className="text-center text-xs font-semibold text-muted-foreground">
                RANKING — TABULEIRO FÍSICO
              </p>
              {resultado.ranking.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">
                  Nenhuma partida física concluída ainda.
                </p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {resultado.ranking.map((sessao, indice) => (
                    <li
                      key={sessao.id}
                      className={cn(
                        "flex items-center gap-2 rounded px-2 py-1",
                        sessao.id === sessaoId && "bg-primary/10 font-semibold",
                      )}
                    >
                      <span className="w-5 text-muted-foreground">{indice + 1}.</span>
                      <span className="flex-1 truncate">{sessao.jogador}</span>
                      <span className="font-cousine">
                        {formatElapsedTime(sessao.tempo_total_s ?? 0)}
                      </span>
                      <span className="w-20 text-right text-xs text-muted-foreground">
                        {sessao.numero_jogadas} jogadas
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {resultado?.tipo === "erro" && (
            <p className="text-center text-xs text-muted-foreground">
              Não foi possível carregar o resultado do servidor.
            </p>
          )}

          {salvamento !== "nao_se_aplica" && (
            <p className="text-center text-xs text-muted-foreground">
              {salvamento === "salvando" && "Salvando resultado…"}
              {salvamento === "salvo" && "Resultado salvo no servidor."}
              {salvamento === "erro" &&
                "Não foi possível salvar o resultado no servidor."}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="sm:w-auto"
              onClick={handleExit}
              disabled={ocupado}
            >
              Sair
            </Button>
            <Button
              className="sm:w-auto"
              onClick={handleRestart}
              disabled={ocupado}
            >
              Nova partida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JogoFisicoPage() {
  const searchParams = useSearchParams();

  const sessaoId = searchParams.get("sessao");
  const jogador = searchParams.get("nome") || "Jogador";

  if (!sessaoId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma sessão informada.
        </p>
        <Link href="/" className="text-sm font-semibold text-primary underline">
          Voltar à tela inicial
        </Link>
      </div>
    );
  }

  const fontePreferida: TipoFonte =
    searchParams.get("fonte") === "simulada" || ehSessaoLocal(sessaoId)
      ? "simulada"
      : "websocket";

  const intervaloMs = Math.min(
    Math.max(Number(searchParams.get("intervalo")) || 1000, 50),
    10_000,
  );

  return (
    <TelaFisico
      key={sessaoId}
      sessaoId={sessaoId}
      jogador={jogador}
      fontePreferida={fontePreferida}
      intervaloMs={intervaloMs}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <JogoFisicoPage />
    </Suspense>
  );
}
