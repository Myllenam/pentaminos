"use client";

import { useEffect, useState } from "react";
import { Trash2, Trophy } from "lucide-react";

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
import { clearRanking, getRanking, type RankingEntry } from "@/lib/ranking";

const MEDALS = ["🥇", "🥈", "🥉"];

export interface RankingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Ranking({ open, onOpenChange }: RankingProps) {
  const [entries, setEntries] = useState<RankingEntry[]>([]);

  useEffect(() => {
    if (open) setEntries(getRanking());
  }, [open]);

  const handleClear = () => {
    clearRanking();
    setEntries(getRanking());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/15">
            <Trophy className="size-5 text-warning" />
          </div>
          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <DialogTitle>Ranking</DialogTitle>
              <DialogDescription>Melhores tempos registrados</DialogDescription>
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

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2 text-left font-medium">#</th>
                <th className="px-4 py-2 text-left font-medium">Jogador</th>
                <th className="px-4 py-2 text-left font-medium">Tempo</th>
                <th className="px-4 py-2 text-left font-medium">Peças</th>
                <th className="px-4 py-2 text-left font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum resultado registrado ainda.
                  </td>
                </tr>
              )}
              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-t border-border",
                    index === 0
                      ? "bg-warning/10"
                      : index % 2 === 1
                        ? "bg-muted/60"
                        : "bg-transparent"
                  )}
                >
                  <td className="px-4 py-3 align-top">
                    {index < 3 ? (
                      <span className="text-base">{MEDALS[index]}</span>
                    ) : (
                      <span className="font-cousine text-sm text-muted-foreground">
                        {index + 1}º
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="font-semibold text-foreground">{entry.player}</span>
                    {entry.autoSolved && (
                      <span className="block text-xs text-muted-foreground italic">
                        auto-resolvido
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top font-cousine font-bold text-primary">
                    {entry.time}
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {entry.pieces} peças
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                    {entry.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button className="sm:w-40" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}