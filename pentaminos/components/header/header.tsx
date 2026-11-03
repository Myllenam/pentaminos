import { Play, RotateCcw, Trophy } from "lucide-react";

import { Logo } from "@/components/logo/logo";
import { Button } from "@/components/ui/button";

export interface HeaderProps {
  playerName: string;
  time: string;
  moves: number;
  filledCells: number;
  totalCells: number;
  onOpenRanking?: () => void;
  onRestart?: () => void;
  onNewGame?: () => void;
  restartDisabled?: boolean;
}

const HEADER_MOCK_DATA: HeaderProps = {
  playerName: "artur",
  time: "00:55",
  moves: 0,
  filledCells: 0,
  totalCells: 30,
};

export function Header({
  playerName = HEADER_MOCK_DATA.playerName,
  time = HEADER_MOCK_DATA.time,
  moves = HEADER_MOCK_DATA.moves,
  filledCells = HEADER_MOCK_DATA.filledCells,
  totalCells = HEADER_MOCK_DATA.totalCells,
  onOpenRanking,
  onRestart,
  onNewGame,
  restartDisabled = false,
}: Partial<HeaderProps>) {
  return (
    <header className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="hidden text-lg font-bold tracking-tight text-foreground sm:inline">
          PENTAMINÓS
        </span>
      </div>

      <div className="order-last flex w-full items-center justify-around gap-4 lg:order-none lg:w-auto lg:gap-8">
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            JOGADOR
          </span>
          <span className="text-sm font-semibold text-foreground">
            {playerName}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            TEMPO
          </span>
          <span className="font-cousine text-sm font-bold text-primary">
            {time}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            MOVIMENTOS
          </span>
          <span className="font-cousine text-sm font-bold text-primary">
            {moves}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            CÉLULAS<span className="hidden sm:inline"> PREENCHIDAS</span>
          </span>
          <span className="text-sm font-semibold">
            <span className="text-primary">
              {filledCells}
            </span>{" "}
            <span className="text-input">
              / {totalCells}
            </span>
          </span>
        </div>
      </div>

      <div className="flex w-auto items-center gap-2">
        <Button
          variant="warning"
          className="w-auto"
          data-icon="inline-start"
          onClick={onOpenRanking}
          aria-label="Ranking"
        >
          <Trophy data-icon="inline-start" />
          <span className="hidden sm:inline">Ranking</span>
        </Button>

        <Button
          variant="outline"
          className="w-auto"
          data-icon="inline-start"
          onClick={onRestart}
          aria-label="Reiniciar"
          disabled={restartDisabled}
          title={
            restartDisabled
              ? "Reiniciar indisponível após a resolução automática"
              : undefined
          }
        >
          <RotateCcw data-icon="inline-start" />
          <span className="hidden sm:inline">Reiniciar</span>
        </Button>

        <Button
          className="w-auto"
          data-icon="inline-start"
          onClick={onNewGame}
          aria-label="Novo Jogo"
        >
          <Play data-icon="inline-start" />
          <span className="hidden sm:inline">Novo Jogo</span>
        </Button>
      </div>
    </header>
  );
}