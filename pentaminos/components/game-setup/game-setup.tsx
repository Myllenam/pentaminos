"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Monitor, Play, Trophy } from "lucide-react";

import { Logo } from "@/components/logo/logo";
import { Ranking } from "@/components/ranking/ranking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuantityStepper } from "@/components/quantity-stepper/quantity-stepper";
import { criarSessaoFisica, criarSessaoLocal } from "@/lib/fisico/api";
import { TOTAL_PECAS_FISICO } from "@/lib/types/fisico";
import { cn } from "@/lib/utils";

type Modo = "digital" | "fisico";

const MODOS: { id: Modo; label: string; icon: typeof Monitor }[] = [
  { id: "digital", label: "Digital", icon: Monitor },
  { id: "fisico", label: "Tabuleiro físico", icon: Camera },
];

export function GameSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pieceCount, setPieceCount] = useState(6);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [modo, setModo] = useState<Modo>("digital");
  const [criandoSessao, setCriandoSessao] = useState(false);
  const [erroSessao, setErroSessao] = useState<string | null>(null);

  const playerName = name.trim() || "Jogador";

  const handleStart = () => {
    const params = new URLSearchParams({
      nome: playerName,
      pecas: String(pieceCount),
    });
    router.push(`/jogar?${params.toString()}`);
  };

  const irParaFisico = (sessao: string, simulado: boolean) => {
    const params = new URLSearchParams({ sessao, nome: playerName });
    if (simulado) params.set("fonte", "simulada");
    router.push(`/jogar-fisico?${params.toString()}`);
  };

  const handleStartFisico = async () => {
    setCriandoSessao(true);
    setErroSessao(null);

    try {
      irParaFisico(await criarSessaoFisica(playerName), false);
    } catch (erro) {
      setErroSessao(
        erro instanceof Error ? erro.message : "Erro ao criar a sessão.",
      );
      setCriandoSessao(false);
    }
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
            Modo de jogo
          </span>
          <div
            role="radiogroup"
            aria-label="Modo de jogo"
            className="grid grid-cols-2 gap-2"
          >
            {MODOS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={modo === id}
                onClick={() => {
                  setModo(id);
                  setErroSessao(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  modo === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="my-6 border-t border-border" />

        {modo === "digital" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wide text-foreground uppercase">
              Quantidade de peças
            </span>
            <QuantityStepper value={pieceCount} onChange={setPieceCount} />
            <span className="text-center text-xs text-muted-foreground">
              Escolha entre 3 e 12 peças.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-wide text-foreground uppercase">
              Quantidade de peças
            </span>
            <p className="text-center text-2xl font-bold text-foreground">
              {TOTAL_PECAS_FISICO}
            </p>
            <span className="text-center text-xs text-muted-foreground">
              O tabuleiro físico usa sempre as 12 peças (6×10).
            </span>
          </div>
        )}

        {erroSessao && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
          >
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Servidor indisponível.</strong> {erroSessao} Inicie o
                backend ou jogue no modo simulado.
              </span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={handleStartFisico}
                disabled={criandoSessao}
              >
                Tentar de novo
              </Button>
              <Button
                variant="secondary"
                onClick={() => irParaFisico(criarSessaoLocal(), true)}
              >
                Jogar em modo simulado
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button
            size="lg"
            data-icon="inline-start"
            className="uppercase tracking-wide"
            onClick={modo === "digital" ? handleStart : handleStartFisico}
            disabled={criandoSessao}
          >
            <Play data-icon="inline-start" />
            {criandoSessao ? "Criando sessão…" : "Iniciar Partida"}
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
        {modo === "digital"
          ? "As peças são sorteadas aleatoriamente entre os 12 pentaminós clássicos."
          : "Monte as peças no tabuleiro real; a câmera acompanha cada jogada."}
      </p>

      <Ranking
  open={rankingOpen}
  onOpenChange={setRankingOpen}
  pieceCount={pieceCount}
/>
    </div>
  );
}
