import { Info, RotateCcw, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ControleItem {
  label: string;
  action: string;
  icon?: LucideIcon;
}

const CONTROLES: ControleItem[] = [
  { label: "Selecionar peça", action: "Clique" },
  { label: "Girar peça", action: "Girar", icon: RotateCcw },
  { label: "Posicionar", action: "Clique no board" },
  { label: "Remover peça", action: "Clique na peça" },
  { label: "Resolver", action: "Botão", icon: Zap },
];

export interface ControlesProps {
  className?: string;
  onInfoClick?: () => void;
}

export function Controles({ className, onInfoClick }: ControlesProps) {
  return (
    <div
      className={cn(
        "w-72 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-border",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          CONTROLES
        </h2>
        <button
          type="button"
          aria-label="Mais informações sobre os controles"
          onClick={onInfoClick}
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground text-white transition-opacity hover:opacity-80"
        >
          <Info className="size-3.5" />
        </button>
      </div>

      <ul className="mt-5 flex flex-col gap-3.5">
        {CONTROLES.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-sm text-muted-foreground">
              {item.label}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold text-foreground"
              data-icon={item.icon ? "inline-start" : undefined}
            >
              {item.icon && <item.icon className="size-3.5" />}
              {item.action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}