import { Play, RotateCcw, Trophy } from "lucide-react";

import { Logo } from "@/components/logo/logo";
import { Button } from "@/components/ui/button";

export interface HeaderProps {
  playerName: string;
  time: string;
  filledCells: number;
  totalCells: number;
  onOpenRanking?: () => void;
  onRestart?: () => void;
  onNewGame?: () => void;
}

const HEADER_MOCK_DATA: HeaderProps = {
  playerName: "artur",
  time: "00:55",
  filledCells: 0,
  totalCells: 30,
};

export function Header({
  playerName = HEADER_MOCK_DATA.playerName,
  time = HEADER_MOCK_DATA.time,
  filledCells = HEADER_MOCK_DATA.filledCells,
  totalCells = HEADER_MOCK_DATA.totalCells,
  onOpenRanking,
  onRestart,
  onNewGame,
}: Partial<HeaderProps>) {
  return (
    <header className="flex w-full items-center justify-between gap-4 border-b border-border bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="text-lg font-bold tracking-tight text-foreground">
          PENTAMINÓS
        </span>
      </div>

      <div className="flex items-center gap-8">
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
          <span className="text-sm font-bold text-primary font-cousine">{time}</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            CÉLULAS PREENCHIDAS
          </span>
          <span className="text-sm font-semibold">
            <span className="text-primary">{filledCells}</span>{" "}
            <span className="text-input">/ {totalCells}</span>
          </span>
        </div>
      </div>

      <div className="flex w-auto items-center gap-2">
        <Button
          variant="warning"
          className="w-auto"
          data-icon="inline-start"
          onClick={onOpenRanking}
        >
          <Trophy data-icon="inline-start" />
          Ranking
        </Button>
        <Button
          variant="outline"
          className="w-auto"
          data-icon="inline-start"
          onClick={onRestart}
        >
          <RotateCcw data-icon="inline-start" />
          Reiniciar
        </Button>
        <Button className="w-auto" data-icon="inline-start" onClick={onNewGame}>
          <Play data-icon="inline-start" />
          Novo Jogo
        </Button>
      </div>
    </header>
  );
}
