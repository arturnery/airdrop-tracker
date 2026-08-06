import Link from "next/link";

import { Nav } from "@/components/nav";
import { Sair } from "@/components/sair";
import { exigirSessao } from "@/lib/auth";

/**
 * Casca do aplicativo: navegação lateral e área de conteúdo.
 *
 * Separada do layout raiz porque as telas de entrada (`app/(auth)`) não têm
 * barra lateral: quem ainda não entrou não tem para onde navegar.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Toda rota do aplicativo exige sessão. A verificação é do servidor: não
  // adianta o menu esconder o link se a URL continua acessível.
  const sessao = await exigirSessao();

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
            <div className="min-w-0 shrink-0 px-5 py-4">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-xs font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                airdrop
                <span className="text-primary">·</span>
                tracker
              </Link>

              {/* O nome ganha o peso visual: é o dado da pessoa, e clicar nele
                  leva ao perfil. A marca vira a linha de cima, discreta. */}
              <Link
                href="/perfil"
                className="hover:text-primary focus-visible:ring-ring mt-3 hidden max-w-full truncate rounded-sm text-base font-semibold tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none lg:block"
                title="Ver perfil"
              >
                {sessao.nome}
              </Link>
            </div>
            <Nav ehAdmin={sessao.papel === "admin"} />
          </div>
          <div className="mt-auto hidden lg:block">
            <Sair />
          </div>
        </aside>

        <main id="conteudo" className="px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
