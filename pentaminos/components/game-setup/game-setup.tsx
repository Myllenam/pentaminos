"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Trophy } from "lucide-react";

import { Logo } from "@/components/logo/logo";
import { Ranking } from "@/components/ranking/ranking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuantityStepper } from "@/components/quantity-stepper/quantity-stepper";

export function GameSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pieceCount, setPieceCount] = useState(6);
  const [rankingOpen, setRankingOpen] = useState(false);

  const handleStart = () => {
    const params = new URLSearchParams({
      nome: name.trim() || "Jogador",
      pecas: String(pieceCount),
    });
    router.push(`/jogar?${params.toString()}`);
  };

  return (
    <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-3">
          <Logo className="size-11" />
          <span className="text-3xl font-bold tracking-tight text-foreground">
            PENTAMINÓS
          </span>
        </div>
        <p className="text-sm text-muted-foreground italic">
          Monte o desafio. Resolva o quebra-cabeça.
        </p>
      </div>

      <div className="w-full rounded-2xl bg-white p-8 shadow-lg ring-1 ring-border">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="player-name"
            className="text-xs font-bold tracking-wide text-foreground uppercase"
          >
            Seu nome
          </label>
          <Input
            id="player-name"
            placeholder="Digite seu nome para jogar"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="my-6 border-t border-border" />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide text-foreground uppercase">
            Quantidade de peças
          </span>
          <QuantityStepper value={pieceCount} onChange={setPieceCount} />
          <span className="text-center text-xs text-muted-foreground">
            Escolha entre 3 e 12 peças.
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            size="lg"
            data-icon="inline-start"
            className="uppercase tracking-wide"
            onClick={handleStart}
          >
            <Play data-icon="inline-start" />
            Iniciar Partida
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            data-icon="inline-start"
            onClick={() => setRankingOpen(true)}
          >
            <Trophy data-icon="inline-start" className="text-warning" />
            Ver Ranking
          </Button>
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-muted-foreground">
        As peças são sorteadas aleatoriamente entre os 12 pentaminós clássicos.
      </p>

      <Ranking
  open={rankingOpen}
  onOpenChange={setRankingOpen}
  pieceCount={pieceCount}
/>
    </div>
  );
}