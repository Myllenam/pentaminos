"use client";

import { useState } from "react";

import { Alert } from "@/components/alert/alert";
import { Header } from "@/components/header/header";
import { Ranking } from "@/components/ranking/ranking";

export default function Page() {
  const [restartOpen, setRestartOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans">
      <Header
        onRestart={() => setRestartOpen(true)}
        onNewGame={() => setNewGameOpen(true)}
        onOpenRanking={() => setRankingOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-between px-16 py-32">
        <p className="font-bold text-foreground">
          Playground de teste — clique em &quot;Reiniciar&quot; ou &quot;Novo Jogo&quot;.
        </p>
      </main>

      <Alert
        open={restartOpen}
        onOpenChange={setRestartOpen}
        title="Reiniciar partida?"
        description="Tem certeza que deseja reiniciar a partida? Todo o progresso atual será perdido."
        confirmLabel="Reiniciar"
        variant="destructive-solid"
        onConfirm={() => console.log("partida reiniciada")}
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