"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Alert } from "@/components/alert/alert";
import { Controles } from "@/components/controles/controles";
import { Header } from "@/components/header/header";
import { ComoJogar } from "@/components/como-jogar/como-jogar";
import { Ranking } from "@/components/ranking/ranking";
import { finishGame, formatElapsedTime } from "@/lib/ranking";
import { Progresso } from "@/components/progresso/progresso";
import {
  getMockGamePieces,
  MOCK_BOARD_CONFIG,
  PENTOMINOES,
} from "@/lib/mocks/pentominos";
import { PlacedPiece } from "@/lib/types/pentomino";
import { PieceCard } from "@/components/pieceCard/pieceCard";
import { Board } from "@/components/board/board";

function GamePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const playerName = searchParams.get("nome") || "Jogador";
  const pieceCount = Number(searchParams.get("pecas")) || 6;
  const totalCells = pieceCount * 5; // cada pentaminó ocupa 5 células

  const [restartOpen, setRestartOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

  // ---- estado do tabuleiro (mockado) ----
  const [pieces, setPieces] = useState<PlacedPiece[]>(() =>
    getMockGamePieces(pieceCount),
  );
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );

  const filledCells = useMemo(
    () => pieces.filter((p) => p.origin !== null).length * 5,
    [pieces],
  );
  const remainingPieces = pieces.filter((p) => p.origin === null);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const handleRestart = () => {
    setElapsedSeconds(0);
    setIsRunning(true);
    setPieces(getMockGamePieces(pieceCount));
    setSelectedInstanceId(null);
    console.log("partida reiniciada");
  };

  const handleSelectPiece = (instanceId: string) => {
    setSelectedInstanceId((current) =>
      current === instanceId ? null : instanceId,
    );
  };

  // clique numa célula do board: remove peça se já ocupada, senão posiciona a selecionada
  const handleCellClick = (row: number, col: number) => {
    const owner = pieces.find((piece) => {
      if (!piece.origin) return false;
      const shape = PENTOMINOES.find((s) => s.id === piece.shapeId);
      if (!shape) return false;
      return shape.cells.some(
        ([r, c]) =>
          piece.origin![0] + r === row && piece.origin![1] + c === col,
      );
    });

    if (owner) {
      setPieces((current) =>
        current.map((p) =>
          p.instanceId === owner.instanceId ? { ...p, origin: null } : p,
        ),
      );
      return;
    }

    if (!selectedInstanceId) return;

    setPieces((current) =>
      current.map((p) =>
        p.instanceId === selectedInstanceId ? { ...p, origin: [row, col] } : p,
      ),
    );
    setSelectedInstanceId(null);
  };

  /**
   * TODO(time): substituir esse botão pela chamada de finishGame()
   * no momento em que a lógica do tabuleiro detectar que todas as
   * células foram preenchidas corretamente.
   */
  const handleFinishTest = () => {
    setIsRunning(false);
    finishGame({
      player: playerName,
      pieces: pieceCount,
      elapsedSeconds,
    });
    setRankingOpen(true);
  };

  return (
    <div className="relative flex min-h-screen flex-col  bg-zinc-50">
      <Header
        playerName={playerName}
        time={formatElapsedTime(elapsedSeconds)}
        filledCells={0}
        totalCells={totalCells}
        onRestart={() => setRestartOpen(true)}
        onNewGame={() => setNewGameOpen(true)}
        onOpenRanking={() => setRankingOpen(true)}
      />

      <main className="mx-auto flex w-full flex-1 flex-row gap-8 px-8 py-12">
        <aside className="w-1/4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-foreground">SUAS PEÇAS</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Clique em uma peça para posicioná-la.
            </p>
            <div className="flex flex-col gap-2">
              {remainingPieces.map((piece) => {
                const shape = PENTOMINOES.find((s) => s.id === piece.shapeId)!;
                return (
                  <PieceCard
                    key={piece.instanceId}
                    shape={shape}
                    selected={selectedInstanceId === piece.instanceId}
                    onSelect={() => handleSelectPiece(piece.instanceId)}
                  />
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col items-center justify-start pt-10">
          <Board
            config={MOCK_BOARD_CONFIG}
            placedPieces={pieces}
            shapes={PENTOMINOES}
            onCellClick={handleCellClick}
          />
        </section>

        <aside className="flex w-[288px] shrink-0 flex-col gap-4 ">
          <Progresso
            celulasPreenchidas={20}
            totalCelulas={30}
            pecasRestantes={2}
          />
          <ComoJogar />

          <Controles onInfoClick={() => console.log("abrir detalhes")} />
        </aside>
      </main>

      <Alert
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title="Reiniciar partida?"
        description="Tem certeza que deseja reiniciar a partida? Todo o progresso atual será perdido."
        confirmLabel="Reiniciar"
        variant="destructive-solid"
        onConfirm={handleRestart}
      />

      <Alert
        open={newGameOpen}
        onOpenChange={setNewGameOpen}
        title="Iniciar novo jogo?"
        description="Deseja abandonar a partida atual e iniciar um novo jogo? O progresso atual será perdido."
        confirmLabel="Novo Jogo"
        onConfirm={() => router.push("/")}
      />

      <Ranking open={rankingOpen} onOpenChange={setRankingOpen} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GamePage />
    </Suspense>
  );
}
