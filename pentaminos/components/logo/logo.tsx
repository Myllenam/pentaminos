import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
}

/**
 * Marca do Pentaminós: peça "X" (pentaminó em formato de cruz) em vermelho
 * sobre um fundo na cor primária do tema.
 */
export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg bg-primary p-1.5",
        className
      )}
    >
      <span className="col-start-2 row-start-1 rounded-[1px] bg-destructive" />
      <span className="col-start-1 row-start-2 rounded-[1px] bg-destructive" />
      <span className="col-start-2 row-start-2 rounded-[1px] bg-destructive" />
      <span className="col-start-3 row-start-2 rounded-[1px] bg-destructive" />
      <span className="col-start-2 row-start-3 rounded-[1px] bg-destructive" />
    </span>
  );
}
