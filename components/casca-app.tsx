"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BotaoRecolher, useBarraRecolhida } from "@/components/barra-lateral";
import { Nav } from "@/components/nav";
import { RodapeLateral } from "@/components/rodape-lateral";
import { cn } from "@/lib/utils";

/**
 * Casca visual do aplicativo.
 *
 * É um componente de cliente porque a barra recolhe, e recolher é estado de
 * navegador. O layout continua sendo servidor: ele resolve sessão, permissão e
 * dados, e passa o resultado pronto para cá. A fronteira importa, porque é o
 * layout que decide o que pode ser visto, e essa decisão não pode depender de
 * nada que o navegador controle.
 *
 * Recolhida, a barra guarda só os ícones. Os rótulos somem da tela mas
 * continuam no DOM como texto acessível, então leitor de tela e busca da página
 * seguem encontrando "Projetos" mesmo quando a palavra não está visível.
 */
export function CascaApp({
  nome,
  ehAdmin,
  feedbackNaoLido,
  children,
}: {
  nome: string;
  ehAdmin: boolean;
  feedbackNaoLido: number;
  children: ReactNode;
}) {
  const recolhida = useBarraRecolhida();

  return (
    <>
      <a
        href="#conteudo"
        className="bg-brand-legivel text-background sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <div
        className={cn(
          "lg:grid lg:min-h-screen",
          recolhida ? "lg:grid-cols-[68px_1fr]" : "lg:grid-cols-[240px_1fr]",
        )}
      >
        <aside className="bg-sidebar border-border sticky top-0 z-40 border-b lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-2 lg:block">
            <div className="min-w-0 shrink-0 px-3 py-4 lg:px-3">
              <div className="flex items-center gap-2 px-2">
                {/* A marca com o símbolo: o LVL identifica de quem é o produto,
                    e o nome diz o que ele faz. Recolhida, o símbolo sozinho
                    continua identificando. */}
                <Link
                  href="/"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-sm text-xs font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Image
                    src="/android-chrome-192x192.png"
                    alt=""
                    width={20}
                    height={20}
                    className="shrink-0 rounded"
                  />
                  <span className={cn("truncate", recolhida && "lg:hidden")}>
                    LVL Airdrops
                  </span>
                </Link>
                <BotaoRecolher />
              </div>

              {/* O nome ganha o peso visual: é o dado da pessoa, e clicar nele
                  leva ao perfil. Some quando a barra recolhe, porque nome
                  truncado em 68px não identifica ninguém.

                  O realce do mouse é azul, e não a cor primária: verde aqui
                  diria "deu certo", que é o significado que ele carrega em todo
                  o resto do sistema. Passar o mouse num nome não é resultado
                  de nada. */}
              <Link
                href="/perfil"
                className={cn(
                  "hover:text-brand-legivel focus-visible:ring-ring mt-3 hidden max-w-full truncate rounded-sm px-2 text-base font-semibold tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none lg:block",
                  recolhida && "lg:hidden",
                )}
                title="Ver perfil"
              >
                {nome}
              </Link>
            </div>
            <Nav
              ehAdmin={ehAdmin}
              feedbackNaoLido={feedbackNaoLido}
              recolhida={recolhida}
            />
          </div>

          <div className="mt-auto hidden lg:block">
            <RodapeLateral recolhida={recolhida} />
          </div>
        </aside>

        <main id="conteudo" className="px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
