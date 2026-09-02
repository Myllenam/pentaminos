"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { Zap } from "lucide-react";

import { Alert } from "@/components/alert/alert";
import { Board } from "@/components/board/board";
import { ComoJogar } from "@/components/como-jogar/como-jogar";
import { Controles } from "@/components/controles/controles";
import { Header } from "@/components/header/header";
import { PieceCard } from "@/components/pieceCard/pieceCard";
import { Progresso } from "@/components/progresso/progresso";
import { Ranking } from "@/components/ranking/ranking";
import { Button } from "@/components/ui/button";

import {
  canPlacePiece,
  gerarTabuleiro,
  getPieceCells,
  getPreviewOrigin,
  transformCells,
} from "@/lib/functions/pentominoGenerator";
import { useSolverWorker } from "@/lib/hooks/useSolverWorker";
import { PENTOMINOES } from "@/lib/mocks/pentominos";
import {
  finishGame,
  formatElapsedTime,
} from "@/lib/ranking";
import { PlacedPiece } from "@/lib/types/pentomino";

function GamePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const playerName =
    searchParams.get("nome") || "Jogador";

  const pieceCount = Math.min(
    Math.max(
      Number(searchParams.get("pecas")) || 6,
      3,
    ),
    12,
  );

  const totalCells = pieceCount * 5;

  const [restartOpen, setRestartOpen] =
    useState(false);

  const [newGameOpen, setNewGameOpen] =
    useState(false);

  const [rankingOpen, setRankingOpen] =
    useState(false);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [moveCount, setMoveCount] =
    useState(0);

  const [isRunning, setIsRunning] =
    useState(true);

  const [isSolving, setIsSolving] =
    useState(false);

  const [autoSolved, setAutoSolved] =
    useState(false);

  const [solveError, setSolveError] =
    useState<string | null>(null);

  const [board] = useState(() =>
    gerarTabuleiro(pieceCount),
  );

  const [pieces, setPieces] = useState<
    PlacedPiece[]
  >(() => board.availablePieces);

  const [
    selectedInstanceId,
    setSelectedInstanceId,
  ] = useState<string | null>(null);

  const { solve } = useSolverWorker();

  const hasRegisteredGame = useRef(false);

  const filledCells = useMemo(
    () =>
      pieces.filter(
        (piece) => piece.origin !== null,
      ).length * 5,
    [pieces],
  );

  const remainingPieces = pieces.filter(
    (piece) => piece.origin === null,
  );

  const selectedPiece =
    pieces.find(
      (piece) =>
        piece.instanceId ===
        selectedInstanceId,
    ) ?? null;

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(
        (current) => current + 1,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, setElapsedSeconds]);

  const handleRestart = () => {
    // Depois que o algoritmo resolve,
    // não permitimos reiniciar a partida.
    if (autoSolved) {
      return;
    }

    hasRegisteredGame.current = false;

    setElapsedSeconds(0);
    setMoveCount(0);
    setIsRunning(true);
    setSolveError(null);

    setPieces(
      board.availablePieces.map((piece) => ({
        ...piece,
        origin: null,
      })),
    );

    setSelectedInstanceId(null);
  };

  const handleSelectPiece = (
    instanceId: string,
  ) => {
    setSelectedInstanceId((current) =>
      current === instanceId
        ? null
        : instanceId,
    );
  };

  const handleRotatePiece = (
    instanceId: string,
  ) => {
    setPieces((current) =>
      current.map((piece) => {
        if (
          piece.instanceId !== instanceId
        ) {
          return piece;
        }

        const nextRotation =
          piece.rotation === 0
            ? 90
            : piece.rotation === 90
              ? 180
              : piece.rotation === 180
                ? 270
                : 0;

        return {
          ...piece,
          rotation: nextRotation,
        };
      }),
    );
  };

  const handleCellClick = (
    row: number,
    col: number,
  ) => {
    // ==========================================
    // 1. COLOCAR UMA PEÇA
    // ==========================================

    if (selectedInstanceId) {
      const selectedPiece = pieces.find(
        (piece) =>
          piece.instanceId ===
          selectedInstanceId,
      );

      if (!selectedPiece) {
        return;
      }

      const shape = PENTOMINOES.find(
        (pentomino) =>
          pentomino.id ===
          selectedPiece.shapeId,
      );

      if (!shape) {
        return;
      }

      const clickedCell: [
        number,
        number,
      ] = [row, col];

      const transformedCells =
        transformCells(
          shape.cells,
          selectedPiece.rotation,
        );

      const origin = getPreviewOrigin(
        transformedCells,
        clickedCell,
      );

      const canPlace = canPlacePiece(
        shape,
        selectedPiece.rotation,
        origin,
        board.config,
        pieces,
        selectedPiece.instanceId,
      );

      // Tentativa inválida não conta.
      if (!canPlace) {
        return;
      }

      // Colocar uma peça conta +1 movimento.
      const nextMoveCount =
        moveCount + 1;

      setMoveCount(nextMoveCount);

      setPieces((current) => {
        const updatedPieces =
          current.map((piece) =>
            piece.instanceId ===
            selectedInstanceId
              ? {
                  ...piece,
                  origin,
                }
              : piece,
          );

        const isFinished =
          updatedPieces.every(
            (piece) =>
              piece.origin !== null,
          );

        // Apenas uma solução feita manualmente
        // entra no ranking.
        if (
          isFinished &&
          !hasRegisteredGame.current
        ) {
          hasRegisteredGame.current =
            true;

          finishGame({
            player: playerName,
            pieces: pieceCount,
            moves: nextMoveCount,
            elapsedSeconds,
          });

          setIsRunning(false);
          setRankingOpen(true);
        }

        return updatedPieces;
      });

      setSelectedInstanceId(null);

      return;
    }

    // ==========================================
    // 2. RETIRAR UMA PEÇA
    // ==========================================

    const owner = pieces.find(
      (piece) => {
        if (!piece.origin) {
          return false;
        }

        const shape =
          PENTOMINOES.find(
            (pentomino) =>
              pentomino.id ===
              piece.shapeId,
          );

        if (!shape) {
          return false;
        }

        const cells = getPieceCells(
          shape,
          piece.rotation,
          piece.origin,
        );

        return cells.some(
          ([cellRow, cellCol]) =>
            cellRow === row &&
            cellCol === col,
        );
      },
    );

    // Célula vazia não conta movimento.
    if (!owner) {
      return;
    }

    // Retirar uma peça conta +1.
    setMoveCount(
      (current) => current + 1,
    );

    setPieces((current) =>
      current.map((piece) =>
        piece.instanceId ===
        owner.instanceId
          ? {
              ...piece,
              origin: null,
            }
          : piece,
      ),
    );
  };

  const handleSolve = async () => {
    if (isSolving) {
      return;
    }

    setIsSolving(true);
    setSolveError(null);
    setSelectedInstanceId(null);

    try {
      // O solver começa com todas as peças
      // fora do tabuleiro.
      const clearedPieces = pieces.map(
        (piece) => ({
          ...piece,
          origin: null,
        }),
      );

      setPieces(clearedPieces);

      const outcome = await solve(
        board.config,
        clearedPieces.map(
          (piece) => ({
            instanceId:
              piece.instanceId,
            shapeId: piece.shapeId,
          }),
        ),
      );

      if (
        outcome.solved &&
        outcome.placements
      ) {
        setIsRunning(false);
        setAutoSolved(true);

        setPieces(
          outcome.placements,
        );

        // Marca a partida como concluída
        // para impedir qualquer registro
        // posterior no ranking.
        //
        // IMPORTANTE:
        // não chamamos finishGame aqui.
        hasRegisteredGame.current =
          true;
      } else {
        setSolveError(
          "Não foi possível encontrar uma solução para este tabuleiro.",
        );
      }
    } catch (erro) {
      setSolveError(
        erro instanceof Error
          ? erro.message
          : "Erro ao resolver o tabuleiro.",
      );
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-50">
      <Header
        playerName={playerName}
        time={formatElapsedTime(
          elapsedSeconds,
        )}
        moves={moveCount}
        filledCells={filledCells}
        totalCells={totalCells}
        onRestart={() =>
          setRestartOpen(true)
        }
        onNewGame={() =>
          setNewGameOpen(true)
        }
        onOpenRanking={() =>
          setRankingOpen(true)
        }
        restartDisabled={autoSolved}
      />

      <main className="mx-auto flex w-full flex-1 flex-row gap-8 px-8 py-12">
        <aside className="w-1/4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-foreground">
              SUAS PEÇAS
            </p>

            <p className="mb-3 text-xs text-muted-foreground">
              Clique em uma peça para posicioná-la.
            </p>

            <div className="flex flex-col gap-2">
              {pieces.map((piece) => (
                <PieceCard
                  key={piece.instanceId}
                  piece={piece}
                  placed={
                    piece.origin !== null
                  }
                  selected={
                    selectedInstanceId ===
                    piece.instanceId
                  }
                  onSelect={() =>
                    handleSelectPiece(
                      piece.instanceId,
                    )
                  }
                  onRotate={() =>
                    handleRotatePiece(
                      piece.instanceId,
                    )
                  }
                />
              ))}
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col items-center justify-start pt-10">
          <Board
            config={board.config}
            placedPieces={pieces}
            shapes={PENTOMINOES}
            previewPiece={
              selectedPiece
            }
            onCellClick={
              handleCellClick
            }
          />

          <div className="mt-6 w-full max-w-md">
            <Button
              variant="outline"
              size="lg"
              onClick={handleSolve}
              disabled={isSolving}
            >
              <Zap
                className="text-warning"
                data-icon="inline-start"
              />

              {isSolving
                ? "Resolvendo..."
                : "Resolver Automaticamente"}
            </Button>

            <p className="mt-2 text-center text-xs text-muted-foreground">
              {solveError ??
                "Verifique o tabuleiro ou use o algoritmo para resolver automaticamente."}
            </p>
          </div>
        </section>

        <aside className="flex w-[288px] shrink-0 flex-col gap-4">
          <Progresso
            celulasPreenchidas={
              filledCells
            }
            totalCelulas={
              totalCells
            }
            pecasRestantes={
              remainingPieces.length
            }
          />

          <ComoJogar />

          <Controles
            onInfoClick={() =>
              console.log(
                "abrir detalhes",
              )
            }
          />
        </aside>
      </main>

      <Alert
        open={restartOpen}
        onOpenChange={
          setRestartOpen
        }
        title="Reiniciar partida?"
        description="Tem certeza que deseja reiniciar a partida? Todo o progresso atual será perdido."
        confirmLabel="Reiniciar"
        variant="destructive-solid"
        onConfirm={handleRestart}
      />

      <Alert
        open={newGameOpen}
        onOpenChange={
          setNewGameOpen
        }
        title="Iniciar novo jogo?"
        description="Deseja abandonar a partida atual e iniciar um novo jogo? O progresso atual será perdido."
        confirmLabel="Novo Jogo"
        onConfirm={() =>
          router.push("/")
        }
      />

      <Ranking
        open={rankingOpen}
        onOpenChange={
          setRankingOpen
        }
        pieceCount={pieceCount}
      />
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