import Link from "next/link";

/**
 * Casca das telas de entrada: uma coluna centrada, sem navegação.
 *
 * Quem ainda não entrou não tem para onde navegar: oferecer menu aqui só
 * daria caminhos que terminam em erro de permissão.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-6">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-sm text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          airdrop
          <span className="text-primary">·</span>
          tracker
        </Link>
      </header>

      <main
        id="conteudo"
        className="flex flex-1 items-start justify-center px-6 pb-16 sm:items-center sm:pb-24"
      >
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="text-muted-foreground px-6 py-6 text-center text-xs">
        Controle de farming de airdrops
      </footer>
    </div>
  );
}
