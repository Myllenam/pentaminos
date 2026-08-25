import { PentominoShape } from "@/components/pentomino-shape/pentomino-shape";

export function BackgroundDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <PentominoShape
        shape="plus"
        colorClassName="bg-primary/15"
        className="absolute top-16 left-10 rotate-[8deg]"
      />
      <PentominoShape
        shape="z"
        colorClassName="bg-primary/10"
        className="absolute bottom-24 left-24 -rotate-6"
      />
      <PentominoShape
        shape="t"
        colorClassName="bg-warning/15"
        className="absolute top-24 right-16 rotate-12"
      />
      <PentominoShape
        shape="l"
        colorClassName="bg-destructive/10"
        className="absolute right-10 bottom-16 -rotate-12"
      />
    </div>
  );
}