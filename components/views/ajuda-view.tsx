"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HelpCircle, Mail } from "lucide-react";

import { explicacoes } from "@/components/ajuda";
import { Suporte } from "@/components/forms/suporte";
import { PageHeader } from "@/components/page-header";
import { LIMITE, JANELA_MINUTOS } from "@/lib/limite-login";

/**
 * Central de ajuda: perguntas comuns, e o caminho para falar com a equipe.
 *
 * Existe como página, e não só como o diálogo de relato (`Suporte`), porque
 * um FAQ precisa de espaço para respirar que um diálogo não tem, e porque
 * boa parte das dúvidas ("esqueci a senha", "o que é exposição") tem
 * resposta pronta: não precisam virar um relato para alguém responder por
 * e-mail depois.
 *
 * As perguntas sobre os números do sistema reaproveitam o texto de
 * `components/ajuda.tsx` em vez de reescrever: é a mesma explicação que
 * aparece na interrogação ao lado de cada número, e explicação divergente
 * entre dois lugares é pior que explicação nenhuma.
 *
 * **"use client" não é opcional aqui.** `components/ajuda.tsx` é `"use
 * client"`, e `explicacoes` é um objeto de JSX já pronto, não um componente.
 * Lido a partir de um componente de servidor, esse conteúdo chega vazio: a
 * fronteira cliente/servidor descarta o que uma árvore de servidor não sabe
 * renderizar sozinha. As quatro perguntas que citam capital, exposição,
 * resultado e volume ficaram em branco até este arquivo virar cliente
 * também, que é como toda outra tela que usa `explicacoes` já funciona.
 */

type Pergunta = { pergunta: string; resposta: ReactNode };
type Grupo = { titulo: string; perguntas: Pergunta[] };

const grupos: Grupo[] = [
  {
    titulo: "Conta e acesso",
    perguntas: [
      {
        pergunta: "Esqueci minha senha, e agora?",
        resposta: (
          <>
            Não existe redefinição automática por e-mail. Peça uma senha nova
            na tela de{" "}
            <Link href="/recuperar-senha" className="underline underline-offset-4">
              recuperar senha
            </Link>
            : o pedido entra numa fila e quem administra a comunidade gera uma
            temporária para você. No primeiro acesso com ela, o sistema pede
            que você defina a sua.
          </>
        ),
      },
      {
        pergunta: "Como troco minha senha?",
        resposta: (
          <>
            Na aba{" "}
            <Link href="/perfil" className="underline underline-offset-4">
              Perfil
            </Link>
            , seção “Trocar senha”. Pede a senha atual antes de aceitar a
            nova, então funciona tanto para trocar por gosto quanto para
            substituir uma temporária.
          </>
        ),
      },
      {
        pergunta: "Errei a senha várias vezes e agora não consigo mais entrar.",
        resposta: (
          <>
            Depois de {LIMITE} tentativas erradas, o login daquele e-mail fica
            bloqueado por {JANELA_MINUTOS} minutos, mesmo que a próxima
            tentativa esteja certa. É proteção contra tentativa e erro
            automatizado, não um bloqueio manual: passado esse tempo, a senha
            correta volta a funcionar sozinha, sem precisar pedir nada a
            ninguém.
          </>
        ),
      },
      {
        pergunta: "Me cadastrei e minha conta está esperando aprovação.",
        resposta:
          "Toda conta nova entra numa fila e precisa ser aprovada por quem administra a comunidade antes do primeiro acesso. Não há um prazo fixo: se estiver demorando, use o e-mail no fim desta página.",
      },
    ],
  },
  {
    titulo: "Como os números são calculados",
    perguntas: [
      { pergunta: "O que é capital depositado?", resposta: explicacoes.capital },
      { pergunta: "O que é exposição atual?", resposta: explicacoes.exposicao },
      { pergunta: "Como o resultado é calculado?", resposta: explicacoes.resultado },
      { pergunta: "O que é volume operado?", resposta: explicacoes.volume },
      {
        pergunta: "Um projeto meu está com um aviso de saldo impossível. O que é isso?",
        resposta: (
          <>
            É um lançamento faltando, não um erro de conta. O sistema soma
            exatamente o que foi registrado, então um saldo negativo ou um
            dinheiro que “aparece” sem depósito quer dizer que falta lançar
            algo: o depósito que bancou uma perda, ou o recebimento de
            airdrop que originou o valor. O aviso some sozinho assim que o
            lançamento que falta é registrado.
          </>
        ),
      },
    ],
  },
  {
    titulo: "Farming",
    perguntas: [
      {
        pergunta: "Como funciona o catálogo de projetos da comunidade?",
        resposta: (
          <>
            Quem administra pode destacar um projeto que já farma, e ele
            aparece para todo mundo em “Farms atuais”, na tela de Projetos.
            Adicionar copia os dados (nome, categoria, rede, links) para um
            projeto seu: a partir daí ele é inteiramente seu, editar ou
            apagar não afeta o catálogo, e o catálogo mudar depois não afeta
            o que você já adicionou.
          </>
        ),
      },
      {
        pergunta: "Como registro pontos ou volume?",
        resposta:
          "Você lança o total acumulado que a plataforma mostra, não o quanto rendeu desde a última vez. O sistema calcula sozinho a diferença em relação à medição anterior, então não precisa fazer a subtração de cabeça.",
      },
    ],
  },
];

export function AjudaView() {
  return (
    <>
      <PageHeader
        icon={HelpCircle}
        title="Ajuda / Suporte"
        description="Perguntas comuns, e como falar com a equipe quando elas não bastam."
      />

      <div className="space-y-10">
        {grupos.map((grupo) => (
          <section key={grupo.titulo}>
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
              {grupo.titulo}
            </h2>
            <div className="divide-border border-border divide-y rounded-lg border">
              {grupo.perguntas.map((item) => (
                // <details> nativo: mesmo padrão já usado no histórico de
                // metas, sem precisar de uma dependência de accordion só
                // para isto.
                <details key={item.pergunta} className="group px-4 py-3.5">
                  <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
                    {item.pergunta}
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180"
                    >
                      ⌄
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
                    {item.resposta}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* O cartão inteiro é o gatilho do diálogo, não um botão dentro dele:
            a área de clique fica do tamanho do que se lê, sem precisar caçar
            um botão pequeno no canto. */}
        <Suporte
          rotuloAcessivel="Falar com a equipe por e-mail"
          className="border-border hover:border-brand/40 focus-visible:ring-ring w-full rounded-lg border p-6 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          gatilho={
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="bg-brand/15 text-brand-legivel flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <Mail className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Falar com a equipe</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  Não achou a resposta acima? Conte o que aconteceu e a tela
                  em que você estava vai junto, sem precisar digitar nada
                  disso. A resposta vai para o e-mail do seu cadastro.
                </p>
              </div>
            </div>
          }
        />
      </div>
    </>
  );
}
