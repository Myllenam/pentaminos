"use client";

import { useState } from "react";

import { Alert } from "@/components/alert/alert";
import { Header } from "@/components/header/header";
import { ComoJogar } from "@/components/como-jogar/como-jogar";

export default function Page() {
  const [restartOpen, setRestartOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans">
      <Header
        onRestart={() => setRestartOpen(true)}
        onNewGame={() => setNewGameOpen(true)}
        onOpenRanking={() => console.log("abrir ranking")}
      />

    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-row gap-8 px-8 py-12">
      
      {/*Peças*/}
      <aside className="w-1/4">
        {/*Peças*/}
      </aside>

      {/*Tabuleiro*/}
      <section className="flex flex-1 flex-col items-center justify-start pt-10">
        <p className="font-bold text-foreground">
          Playground de teste — clique em &quot;Reiniciar&quot; ou &quot;Novo Jogo&quot;.
        </p>
        {/*Tabuleiro + Botão de Resolver*/}
      </section>

      <aside className="flex w-1/4 flex-col gap-6">
        {/*Progresso*/}
        {/*Como Jogar*/}
        <ComoJogar />
        {/*Controles*/}
      </aside>

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
    </div>
  );
}
