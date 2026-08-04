import Link from "next/link";

import { Nav } from "@/components/nav";
import { RestaurarDados } from "@/components/restaurar-dados";

/**
 * Casca do aplicativo: navegação lateral e área de conteúdo.
 *
 * Separada do layout raiz porque as telas de entrada (`app/(auth)`) não têm
 * barra lateral — quem ainda não entrou não tem para onde navegar.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a
        href="#conteudo"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[240px_1fr]">
        {/* Um único <nav> no DOM: em telas estreitas fica ao lado da marca,
            em telas largas empilha abaixo. Duplicar faria o leitor de tela
            anunciar dois menus idênticos. */}
        <aside className="bg-sidebar border-border sticky top-0 z-40 border-b lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-2 lg:block">
            <div className="shrink-0 px-5 py-4">
              <Link
                href="/"
                className="focus-visible:ring-ring rounded-sm text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
              >
                airdrop
                <span className="text-primary">·</span>
                tracker
              </Link>
              <p className="text-muted-foreground mt-0.5 hidden text-xs lg:block">
                Controle de farming
              </p>
            </div>
            <Nav />
          </div>
          <div className="mt-auto hidden lg:block">
            <RestaurarDados />
          </div>
        </aside>

        <main id="conteudo" className="px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
