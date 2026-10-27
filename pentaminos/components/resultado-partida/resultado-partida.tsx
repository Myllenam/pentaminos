"use client";

import { PartyPopper, Trophy, Zap } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PENTOMINOES } from "@/lib/mocks/pentominos";
import {
  GAME_MODE_LABELS,
  type FinalBoard,
  type GameMode,
  type PlacementStep,
} from "@/lib/ranking";

export interface GameResult {
  time: string;
  moves: number;
  mode: GameMode;
  autoSolved: boolean;
  placements: PlacementStep[];
  finalBoard: FinalBoard;
}

export interface ResultadoPartidaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: GameResult | null;
  onOpenRanking?: () => void;
  saveError?: string | null;
}

function getShapeColor(shapeId: string) {
  return (
    PENTOMINOES.find((shape) => shape.id === shapeId)
      ?.color ?? "#e5e7eb"
  );
}

export function FinalBoardView({
  board,
}: {
  board: FinalBoard;
}) {
  const cols = board[0]?.length ?? 0;

  return (
    <div
      className="grid w-fit border border-gray-200"
      style={{
        gridTemplateColumns: `repeat(${cols}, 28px)`,
      }}
    >
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className="flex size-7 items-center justify-center border border-gray-200 text-xs font-bold text-white"
            style={{
              backgroundColor: cell
                ? getShapeColor(cell)
                : "white",
            }}
          >
            {cell}
          </div>
        )),
      )}
    </div>
  );
}

export function PlacementList({
  placements,
}: {
  placements: PlacementStep[];
}) {
  return (
    <ol className="flex flex-col gap-1.5">
      {placements.map((step) => (
        <li
          key={step.order}
          className="flex items-center gap-3 text-sm"
        >
          <span className="w-5 text-right font-cousine text-xs text-muted-foreground">
            {step.order}º
          </span>

          <span
            className="flex size-6 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{
              backgroundColor: getShapeColor(
                step.shapeId,
              ),
            }}
          >
            {step.shapeId}
          </span>

          <span className="text-xs text-muted-foreground">
            linha {step.origin[0] + 1}, coluna{" "}
            {step.origin[1] + 1} · {step.rotation}°
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ResultadoPartida({
  open,
  onOpenChange,
  result,
  onOpenRanking,
  saveError,
}: ResultadoPartidaProps) {
  if (!result) {
    return null;
  }

  const Icon = result.autoSolved
    ? Zap
    : PartyPopper;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/15">
            <Icon className="size-5 text-warning" />
          </div>

          <div>
            <DialogTitle>
              {result.autoSolved
                ? "Solução encontrada"
                : "Partida concluída!"}
            </DialogTitle>

            <DialogDescription>
              {result.autoSolved
                ? "Resolvido pelo algoritmo — não entra no ranking."
                : `Tempo ${result.time} · ${result.moves} movimentos · modo ${GAME_MODE_LABELS[result.mode]}`}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Solução final
            </span>

            <FinalBoardView
              board={result.finalBoard}
            />
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Ordem de colocação
            </span>

            <div className="max-h-72 overflow-y-auto pr-1">
              <PlacementList
                placements={result.placements}
              />
            </div>
          </div>
        </div>

        {saveError && (
          <p className="text-xs text-destructive">
            {saveError}
          </p>
        )}

        <DialogFooter>
          {!result.autoSolved &&
            onOpenRanking && (
              <Button
                variant="outline"
                className="sm:w-40"
                onClick={onOpenRanking}
              >
                <Trophy
                  data-icon="inline-start"
                  className="text-warning"
                />
                Ver ranking
              </Button>
            )}

          <Button
            className="sm:w-40"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
