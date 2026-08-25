"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlagTriangleRight } from "lucide-react";

import { Alert } from "@/components/alert/alert";
import { Controles } from "@/components/controles/controles";
import { Header } from "@/components/header/header";
import { Ranking } from "@/components/ranking/ranking";
import { Button } from "@/components/ui/button";
import { finishGame, formatElapsedTime } from "@/lib/ranking";

function GamePage() {
  const searchParams = useSearchParams();
  const playerName = searchParams.get("nome") || "Jogador";
  const pieceCount = Number(searchParams.get("pecas")) || 6;
  const totalCells = pieceCount * 5; // cada pentaminó ocupa 5 células

  const [restartOpen, setRestartOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

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
    console.log("partida reiniciada");
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
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans">
      <Header
        playerName={playerName}
        time={formatElapsedTime(elapsedSeconds)}
        filledCells={0}
        totalCells={totalCells}
        onRestart={() => setRestartOpen(true)}
        onNewGame={() => setNewGameOpen(true)}
        onOpenRanking={() => setRankingOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-between px-16 py-32">
        <p className="font-bold text-foreground">
          Playground de teste — clique em &quot;Reiniciar&quot; ou &quot;Novo Jogo&quot;.
        </p>

        {/* Botão temporário só para validar o fluxo de vitória + ranking.
            Remover quando a lógica real do tabuleiro estiver pronta. */}
        <Button
          type="button"
          variant="secondary"
          data-icon="inline-start"
          className="w-auto"
          onClick={handleFinishTest}
        >
          <FlagTriangleRight data-icon="inline-start" />
          Finalizar jogo (teste)
        </Button>
      </main>

      <div className="fixed right-6 bottom-8 z-40">
        <Controles onInfoClick={() => console.log("abrir detalhes")} />
      </div>

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
        onConfirm={() => console.log("novo jogo iniciado")}
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