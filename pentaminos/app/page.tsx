import { Header } from "@/components/header/header";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans">
      {/* Preview temporário do Header - remover depois de visualizar */}
      <Header />

      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 mx-auto">
        <p className="text-lime-950 font-bold">PENTAMINÓS</p>
      </main>
    </div>
  );
}
