"use client";

import { useState } from "react";
import {
  Trash2,
  Trophy,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  clearRanking,
  getRanking,
  type RankingSort,
} from "@/lib/ranking";

const MEDALS = ["🥇", "🥈", "🥉"];

export interface RankingProps {
  open: boolean;
  onOpenChange: (
    open: boolean,
  ) => void;
  pieceCount: number;
}

export function Ranking({
  open,
  onOpenChange,
  pieceCount,
}: RankingProps) {
  const [sortBy, setSortBy] =
    useState<RankingSort>("time");

  const [, setRefreshVersion] =
    useState(0);

  const entries = open
    ? getRanking({
        pieces: pieceCount,
        sortBy,
      })
    : [];

  const handleClear = () => {
    clearRanking();

    setRefreshVersion(
      (current) => current + 1,
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/15">
            <Trophy className="size-5 text-warning" />
          </div>

          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <DialogTitle>
                Ranking
              </DialogTitle>

              <DialogDescription>
                Melhores resultados com{" "}
                {pieceCount} peças
              </DialogDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="w-auto text-muted-foreground hover:text-destructive"
              onClick={handleClear}
              aria-label="Limpar ranking"
            >
              <Trash2 />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ordenar por
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={
                sortBy === "time"
                  ? "default"
                  : "outline"
              }
              className="w-auto"
              onClick={() =>
                setSortBy("time")
              }
            >
              Tempo
            </Button>

            <Button
              type="button"
              size="sm"
              variant={
                sortBy === "moves"
                  ? "default"
                  : "outline"
              }
              className="w-auto"
              onClick={() =>
                setSortBy("moves")
              }
            >
              Movimentos
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2 text-left font-medium">
                  #
                </th>

                <th className="px-4 py-2 text-left font-medium">
                  Jogador
                </th>

                <th className="px-4 py-2 text-left font-medium">
                  Tempo
                </th>

                <th className="px-4 py-2 text-left font-medium">
                  Movimentos
                </th>

                <th className="px-4 py-2 text-left font-medium">
                  Peças
                </th>

                <th className="px-4 py-2 text-left font-medium">
                  Data
                </th>
              </tr>
            </thead>

            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Nenhum resultado
                    registrado com{" "}
                    {pieceCount} peças.
                  </td>
                </tr>
              )}

              {entries.map(
                (entry, index) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      "border-t border-border",
                      index === 0
                        ? "bg-warning/10"
                        : index % 2 === 1
                          ? "bg-muted/60"
                          : "bg-transparent",
                    )}
                  >
                    <td className="px-4 py-3 align-top">
                      {index < 3 ? (
                        <span className="text-base">
                          {MEDALS[index]}
                        </span>
                      ) : (
                        <span className="font-cousine text-sm text-muted-foreground">
                          {index + 1}º
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span className="font-semibold text-foreground">
                        {entry.player}
                      </span>
                    </td>

                    <td
                      className={cn(
                        "px-4 py-3 align-top font-cousine font-bold",
                        sortBy === "time"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {entry.time}
                    </td>

                    <td
                      className={cn(
                        "px-4 py-3 align-top font-cousine font-semibold",
                        sortBy === "moves"
                          ? "text-primary"
                          : "text-foreground",
                      )}
                    >
                      {entry.moves ?? "—"}
                    </td>

                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {entry.pieces} peças
                    </td>

                    <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                      {entry.date}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button
            className="sm:w-40"
            onClick={() =>
              onOpenChange(false)
            }
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}