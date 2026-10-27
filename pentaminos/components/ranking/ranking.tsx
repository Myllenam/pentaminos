"use client";

import { Fragment, useEffect, useState } from "react";
import {
  ChevronDown,
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
import {
  FinalBoardView,
  PlacementList,
} from "@/components/resultado-partida/resultado-partida";
import { cn } from "@/lib/utils";
import {
  clearRanking,
  GAME_MODE_LABELS,
  getRanking,
  type GameMode,
  type RankingEntry,
  type RankingSort,
} from "@/lib/ranking";

const GAME_MODES: GameMode[] = ["digital", "fisico"];

const MEDALS = ["🥇", "🥈", "🥉"];

export interface RankingProps {
  open: boolean;
  onOpenChange: (
    open: boolean,
  ) => void;
  pieceCount: number;
  mode?: GameMode;
}

export function Ranking({
  open,
  onOpenChange,
  pieceCount,
  mode = "digital",
}: RankingProps) {
  const [sortBy, setSortBy] =
    useState<RankingSort>("time");

  const [modeFilter, setModeFilter] =
    useState<GameMode>(mode);

  const [entries, setEntries] = useState<
    RankingEntry[]
  >([]);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [refreshVersion, setRefreshVersion] =
    useState(0);

  const [expandedId, setExpandedId] =
    useState<string | null>(null);

  // Sempre que o diálogo abre, o filtro
  // volta para o modo da partida atual.
  const [wasOpen, setWasOpen] =
    useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setModeFilter(mode);
      setExpandedId(null);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    getRanking({
      pieces: pieceCount,
      mode: modeFilter,
      sortBy,
    })
      .then((ranking) => {
        if (cancelled) return;

        setEntries(ranking);
        setLoadError(null);
      })
      .catch((erro) => {
        if (cancelled) return;

        setEntries([]);
        setLoadError(
          erro instanceof Error
            ? erro.message
            : "Erro ao carregar o ranking.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    pieceCount,
    modeFilter,
    sortBy,
    refreshVersion,
  ]);

  const handleClear = async () => {
    try {
      await clearRanking();
    } catch (erro) {
      setLoadError(
        erro instanceof Error
          ? erro.message
          : "Erro ao limpar o ranking.",
      );
    }

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
                {pieceCount} peças no modo{" "}
                {GAME_MODE_LABELS[modeFilter].toLowerCase()}
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
            Modo
          </span>

          <div className="flex items-center gap-2">
            {GAME_MODES.map((gameMode) => (
              <Button
                key={gameMode}
                type="button"
                size="sm"
                variant={
                  modeFilter === gameMode
                    ? "default"
                    : "outline"
                }
                className="w-auto"
                onClick={() =>
                  setModeFilter(gameMode)
                }
              >
                {GAME_MODE_LABELS[gameMode]}
              </Button>
            ))}
          </div>
        </div>

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

                <th className="px-2 py-2">
                  <span className="sr-only">
                    Detalhes
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    {loadError ??
                      `Nenhum resultado registrado com ${pieceCount} peças no modo ${GAME_MODE_LABELS[modeFilter].toLowerCase()}.`}
                  </td>
                </tr>
              )}

              {entries.map(
                (entry, index) => {
                  const hasDetails =
                    !!entry.finalBoard &&
                    !!entry.placements;

                  const expanded =
                    expandedId === entry.id;

                  return (
                <Fragment key={entry.id}>
                  <tr
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

                    <td className="px-2 py-2 align-top">
                      {hasDetails && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="w-auto text-muted-foreground"
                          aria-label={
                            expanded
                              ? "Ocultar solução"
                              : "Ver solução"
                          }
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedId(
                              expanded
                                ? null
                                : entry.id,
                            )
                          }
                        >
                          <ChevronDown
                            className={cn(
                              "transition-transform",
                              expanded &&
                                "rotate-180",
                            )}
                          />
                        </Button>
                      )}
                    </td>
                  </tr>

                  {expanded &&
                    entry.finalBoard &&
                    entry.placements && (
                      <tr className="border-t border-border bg-muted/30">
                        <td
                          colSpan={7}
                          className="px-4 py-4"
                        >
                          <div className="flex flex-col gap-6 sm:flex-row">
                            <FinalBoardView
                              board={
                                entry.finalBoard
                              }
                            />

                            <div className="max-h-56 flex-1 overflow-y-auto">
                              <PlacementList
                                placements={
                                  entry.placements
                                }
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                </Fragment>
                  );
                },
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