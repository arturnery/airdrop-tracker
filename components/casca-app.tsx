"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BarraSuperior } from "@/components/barra-superior";
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
  novidadesNaoVistas,
  children,
}: {
  nome: string;
  ehAdmin: boolean;
  feedbackNaoLido: number;
  novidadesNaoVistas: number;
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
              <div
                className={cn(
                  "flex items-center gap-2 px-2 pb-4",
                  // 68px não cabe ícone e botão de recolher lado a lado: sem
                  // isso, o link do logo era espremido a largura zero pelo
                  // `min-w-0 flex-1` (sumia da tela, mesmo existindo no DOM).
                  // Empilhado, os dois cabem com folga.
                  recolhida && "flex-col gap-3",
                  // A linha só separa algo de algo: recolhida, só sobra o
                  // símbolo, e uma borda sob um ícone sozinho seria ruído.
                  !recolhida && "border-border border-b",
                )}
              >
                {/* A marca com o símbolo: o ícone identifica de quem é o
                    produto, e o nome por extenso diz a quem ele pertence.
                    Recolhida, o símbolo sozinho continua identificando.

                    Ícone e nome maiores, e a cor de repouso é a do texto
                    normal, não a apagada: antes os dois pesavam menos que
                    qualquer outro item da barra, e é a primeira coisa que
                    deveria ser lida, não a última. O azul só aparece no
                    hover, reservado ao gesto de clicar. */}
                <Link
                  href="/"
                  className={cn(
                    "text-foreground hover:text-brand-legivel focus-visible:ring-ring flex items-center gap-2.5 rounded-sm text-sm font-semibold tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    recolhida ? "shrink-0" : "min-w-0 flex-1",
                  )}
                >
                  <Image
                    src="/android-chrome-192x192.png"
                    alt=""
                    width={30}
                    height={30}
                    className="shrink-0 rounded-md"
                  />
                  <span className={cn("truncate", recolhida && "lg:hidden")}>
                    Level Cripto
                  </span>
                </Link>
                <BotaoRecolher />
              </div>

              {/* O nome ganha o peso visual: é o dado da pessoa, e clicar nele
                  leva ao perfil. Some quando a barra recolhe, porque nome
                  truncado em 68px não identifica ninguém.

                  Vem logo depois da linha, e não colado nela: separado da marca
                  por hierarquia, é o dado de quem está usando, não do produto.

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
            <RodapeLateral recolhida={recolhida} novidadesNaoVistas={novidadesNaoVistas} />
          </div>
        </aside>

        <main id="conteudo" className="flex min-h-screen flex-col">
          <BarraSuperior />
          <div className="px-6 py-8 lg:px-10 lg:py-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </div>
        </main>
      </div>
    </>
  );
}
