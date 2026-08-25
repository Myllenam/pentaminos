import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-8">
      Página Inicial
      <div className="flex flex-col items-center w-56">
        <Button asChild>
          <Link href="/jogar">Ir para o jogo</Link>
        </Button>
      </div>
    </div>
  );
}
