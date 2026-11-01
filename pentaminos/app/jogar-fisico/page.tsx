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
  criarSessaoFisica,
  criarSessaoLocal,
  ehSessaoLocal,
  finalizarSessao,
} from "@/lib/fisico/api";
import { casasPreenchidas, pecasValidas } from "@/lib/fisico/estado";
import { TipoFonte } from "@/lib/fisico/fontes";
import { useJogoFisico } from "@/lib/hooks/useJogoFisico";
import { formatElapsedTime } from "@/lib/ranking";
import {
  COLUNAS_FISICO,
  LINHAS_FISICO,
  TOTAL_PECAS_FISICO,
} from "@/lib/types/fisico";

type Salvamento = "nao_se_aplica" | "salvando" | "salvo" | "erro";

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

  const { estado, venceu, conexao, reconectando, fonteAtiva, caiuParaSimulado } =
    useJogoFisico(sessaoId, fontePreferida, {
      intervaloSimuladoMs: intervaloMs,
    });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [vitoriaFechada, setVitoriaFechada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvamento, setSalvamento] =
    useState<Salvamento>("nao_se_aplica");

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
    estado.camera === "desconectada" || estado.tabuleiro === "perdido";

  const abandonarSePreciso = async () => {
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
          <IndicadorCamera camera={estado.camera} tabuleiro={estado.tabuleiro} />
        </div>

        <div className="flex w-full gap-2 sm:w-auto [&>button]:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
          <Button
            variant="outline"
            onClick={() => setPausado((atual) => !atual)}
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

          {erro && (
            <div className="flex w-full max-w-[640px] items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <BoardFisico
            grade={estado.grade}
            pecasInvalidas={invalidas}
            sobreposicao={
              cameraPerdida ? (
                <div className="flex max-w-xs flex-col items-center gap-2 rounded-lg bg-white px-5 py-4 text-center shadow-lg ring-1 ring-amber-200">
                  <CameraOff className="size-6 text-amber-600" />
                  <p className="font-semibold text-foreground">
                    {estado.camera === "desconectada"
                      ? "Câmera desconectada"
                      : "Tabuleiro perdido"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mostrando a última leitura. Verifique a câmera e se o
                    tabuleiro está inteiro no campo de visão.
                  </p>
                </div>
              ) : null
            }
          />

          {invalidas.size > 0 && (
            <ul className="flex w-full max-w-[640px] flex-col gap-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {[...invalidas].map((letra) => (
                <li key={letra} className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  Peça {letra} inválida:{" "}
                  {estado.pecas[letra as keyof typeof estado.pecas]?.motivo}
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
            <OrdemColocacao ordem={estado.ordemColocacao} />
          </div>

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
