import { BackgroundDecoration } from "@/components/background-decoration/background-decoration";
import { GameSetup } from "@/components/game-setup/game-setup";

export default function Home() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-50 px-4 py-16">
      <BackgroundDecoration />
      <GameSetup />
    </div>
  );
}
