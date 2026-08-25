interface ProgressoProps {
  celulasPreenchidas: number;
  totalCelulas: number;
  pecasRestantes: number;
}

const RAIO = 40;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export function Progresso({
  celulasPreenchidas,
  totalCelulas,
  pecasRestantes,
}: ProgressoProps) {
  const percentual =
    totalCelulas > 0
      ? Math.round((celulasPreenchidas / totalCelulas) * 100)
      : 0;
  const offset = CIRCUNFERENCIA * (1 - percentual / 100);

  return (
    <div className="w-full rounded-md border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-bold tracking-wide text-foreground">
        PROGRESSO
      </p>

      <div className="relative mx-auto my-5 flex h-28 w-28 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RAIO}
            fill="none"
            strokeWidth="8"
            className="stroke-secondary"
          />
          <circle
            cx="50"
            cy="50"
            r={RAIO}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={offset}
            className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <span className="relative text-xl font-bold text-primary">
          {percentual}%
        </span>
      </div>

      <p className="text-center text-lg font-bold text-foreground">
        {celulasPreenchidas} de {totalCelulas} células
      </p>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {pecasRestantes}{" "}
        {pecasRestantes === 1 ? "peça restante" : "peças restantes"}
      </p>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}
