"use client";

import { CalendarClock, ExternalLink, Megaphone } from "lucide-react";

import { BotaoCompartilharX } from "@/components/compartilhar-x";
import { AvisoComIA, NovoAviso } from "@/components/forms/aviso";
import { BotaoLixeira, ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { useDados } from "@/components/data-provider";
import { EmptyState, PageHeader } from "@/components/page-header";
import type { Aviso } from "@/db/queries/avisos";
import { postDeAviso } from "@/lib/compartilhar-x";
import { daysBetween, formatDateShort } from "@/lib/dates";
import { formatarQuando } from "@/lib/lives";
import { urlExterna } from "@/lib/links";
import { cn } from "@/lib/utils";

/**
 * Mural de avisos da área Airdrops: anúncios de projeto, um card por aviso,
 * do mais recente ao mais antigo. Cada área terá o seu mural, para notícia
 * de airdrop não se misturar com a de mercado ou de trade.
 *
 * Todos podem compartilhar um aviso no X: o post leva o @ do projeto, o link
 * oficial e o convite da comunidade, e é a divulgação que mais circula.
 */
export function AvisosView({ avisos, ehAdmin }: { avisos: Aviso[]; ehAdmin: boolean }) {
  return (
    <>
      <PageHeader
        icon={Megaphone}
        title="Avisos"
        description="Anúncios de airdrop que importam para a comunidade: o que aconteceu, o que fazer e até quando."
        actions={
          ehAdmin ? (
            <>
              <AvisoComIA />
              <NovoAviso />
            </>
          ) : null
        }
      />
      {avisos.length === 0 ? (
        <EmptyState
          title="Nenhum aviso ainda."
          description={ehAdmin ? "Publique o primeiro em Aviso com IA ou Novo aviso." : "Quando sair um anúncio importante, ele aparece aqui."}
        />
      ) : (
        <ul className="space-y-4">
          {avisos.map((aviso) => (
            <li key={aviso.id}>
              <CardAviso aviso={aviso} ehAdmin={ehAdmin} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Prazo({ prazo }: { prazo: string }) {
  const { hoje } = useDados();
  const faltam = daysBetween(hoje, prazo);
  const texto =
    faltam < 0 ? "encerrado" : faltam === 0 ? "termina hoje" : faltam === 1 ? "termina amanhã" : `faltam ${faltam} dias`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        faltam < 0 ? "border-border text-muted-foreground" : faltam <= 3 ? "border-caution/40 bg-caution/10 text-caution" : "border-border",
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden="true" />
      Prazo {formatDateShort(prazo)} · {texto}
    </span>
  );
}

function CardAviso({ aviso, ehAdmin }: { aviso: Aviso; ehAdmin: boolean }) {
  const { acoes } = useDados();
  const link = urlExterna(aviso.link);
  const post = postDeAviso({
    chamada: aviso.chamadaX ?? aviso.titulo,
    projeto: aviso.projeto ? { nome: aviso.projeto, perfil: aviso.perfilX } : null,
    link,
  });

  return (
    <article className="bg-card border-border rounded-lg border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">
            {aviso.projeto ? <span className="text-foreground font-medium">{aviso.projeto} · </span> : null}
            {formatarQuando(aviso.publicadoEm)}
          </p>
          <h2 className="mt-1 text-lg leading-snug font-semibold tracking-tight text-balance">{aviso.titulo}</h2>
        </div>
        {ehAdmin ? (
          <ConfirmarExclusao
            titulo="Excluir aviso"
            alvo={aviso.titulo}
            aoConfirmar={() => acoes.excluirAviso(aviso.id)}
            gatilho={<BotaoLixeira rotulo={`Excluir aviso ${aviso.titulo}`} />}
          />
        ) : null}
      </div>

      <p className="mt-3 max-w-[70ch] text-sm leading-relaxed whitespace-pre-line">{aviso.resumo}</p>

      {aviso.acao ? (
        <div className="bg-secondary/40 mt-4 rounded-md px-4 py-3">
          <p className="text-xs font-medium tracking-wider uppercase">O que fazer</p>
          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{aviso.acao}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {aviso.prazo ? <Prazo prazo={aviso.prazo} /> : null}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-accent focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Anúncio oficial
            </a>
          ) : null}
          <BotaoCompartilharX texto={post} doQue="do anúncio ou do seu resultado no projeto" />
        </span>
      </div>
    </article>
  );
}
