import Image from "next/image";
import Link from "next/link";

import { Nav } from "@/components/nav";
import { Sair } from "@/components/sair";
import { TrocaObrigatoria } from "@/components/views/troca-obrigatoria";
import { carregarUsuario } from "@/db/queries/usuario";
import { contarNaoLidos } from "@/actions/feedback";
import { Suporte } from "@/components/forms/suporte";
import { versaoAtual } from "@/lib/changelog";
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

  /*
   * O nome vem do banco, não do token: o JWT é assinado no login e congela o
   * nome daquele momento, então trocá-lo no perfil não mudaria a barra lateral
   * até sair e entrar de novo. Identidade continua vindo da sessão.
   */
  const usuario = await carregarUsuario(sessao.id);
  const nomeExibido = usuario?.nome ?? sessao.nome;

  /*
   * A contagem só é consultada para quem administra: ela lê a tabela inteira,
   * sem filtro por usuário, e não deve custar uma consulta a cada navegação de
   * quem nunca vai ver o número.
   */
  const naoLidos = sessao.papel === "admin" ? await contarNaoLidos() : 0;

  /*
   * Senha temporária trava o sistema na própria troca.
   *
   * Quem administra viu essa senha ao gerá-la, então ela não pode continuar
   * valendo enquanto a pessoa usa o sistema.
   *
   * O layout **substitui** o conteúdo em vez de redirecionar. Redirecionar
   * exigiria saber a rota atual, que um layout não recebe, e como este layout
   * envolve toda rota autenticada, trocar o conteúdo bloqueia todas de uma vez:
   * uma tela nova nasce protegida sem ninguém precisar lembrar.
   *
   * Isso é a camada visual. A que vale está em `actions/_core.ts`, que recusa
   * qualquer escrita nesse estado: esconder a tela não impediria a requisição
   * direta à Server Action.
   */
  if (usuario?.precisaTrocarSenha) {
    return <TrocaObrigatoria nome={nomeExibido} />;
  }

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
              {/* A marca com o símbolo: o LVL identifica de quem é o produto,
                  e o nome diz o que ele faz. Juntos numa linha discreta, porque
                  o protagonista da barra é o nome de quem entrou. */}
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-sm text-xs font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Image
                  src="/android-chrome-192x192.png"
                  alt=""
                  width={18}
                  height={18}
                  className="rounded"
                />
                LVL Airdrops
              </Link>

              {/* O nome ganha o peso visual: é o dado da pessoa, e clicar nele
                  leva ao perfil. A marca vira a linha de cima, discreta. */}
              <Link
                href="/perfil"
                className="hover:text-primary focus-visible:ring-ring mt-3 hidden max-w-full truncate rounded-sm text-base font-semibold tracking-tight transition-colors focus-visible:ring-2 focus-visible:outline-none lg:block"
                title="Ver perfil"
              >
                {nomeExibido}
              </Link>
            </div>
            <Nav
              ehAdmin={sessao.papel === "admin"}
              feedbackNaoLido={naoLidos}
            />
          </div>
          <div className="mt-auto hidden lg:block">
            <Sair />
          </div>
        </aside>

        <main id="conteudo" className="px-6 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>

          {/*
            Rodapé discreto, não item de menu: o histórico de mudanças é
            consulta ocasional, e o menu é para o que se faz todo dia. É onde
            produtos como Stripe e Linear colocam o changelog.
          */}
          <footer className="border-border text-muted-foreground mx-auto mt-16 flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs">
            <Link
              href="/novidades"
              className="hover:text-foreground transition-colors"
            >
              Novidades da versão {versaoAtual}
            </Link>
            {/* Aberto de qualquer tela de propósito: é o que permite anexar a
                rota de origem ao relato sem perguntar nada. */}
            <Suporte />
          </footer>
        </main>
      </div>
    </>
  );
}
