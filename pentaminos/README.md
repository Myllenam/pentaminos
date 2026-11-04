# Front — Pentaminós

Telas do jogo em Next.js: `/` (início), `/jogar` (modo digital) e `/jogar-fisico` (modo físico).

## Como rodar

```powershell
cd pentaminos
pnpm install
copy .env.example .env.local   # opcional; o padrão é o backend em localhost:8000
pnpm dev
```

Abra http://localhost:3000.

- **Modo físico:** precisa do [backend](backend/README.md) e da [visão](visao/README.md). Sem conexão com o backend em 5 s, a tela mostra uma partida simulada.
- **Testes:** `pnpm test`, `pnpm lint` e `pnpm build`.
