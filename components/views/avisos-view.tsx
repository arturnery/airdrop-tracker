"use client";

import { ArrowRight, CalendarClock, ExternalLink, Megaphone, ShieldAlert } from "lucide-react";

import { CompartilharAvisoX } from "@/components/compartilhar-aviso-x";
import { AvisoComIA, NovoAviso } from "@/components/forms/aviso";
import { BotaoLixeira, ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { IconeX } from "@/components/icones-marca";
import { useDados } from "@/components/data-provider";
import { EmptyState, PageHeader } from "@/components/page-header";
import type { Aviso } from "@/db/queries/avisos";
import { postAnuncioDoAviso } from "@/lib/compartilhar-x";
import { daysBetween, formatDateShort } from "@/lib/dates";
import { formatarQuando } from "@/lib/lives";
import { urlExterna } from "@/lib/links";
import { cn } from "@/lib/utils";

/**
 * Mural de avisos da área Airdrops. Cada área terá o seu mural, para notícia
 * de airdrop não se misturar com a de mercado ou de trade.
 *
 * O mais recente abre em destaque, na largura toda; os anteriores vêm em duas
 * colunas, mais compactos. Dentro do card, a ordem é a de leitura de quem
 * chega: de quem é a notícia e até quando vale, o que aconteceu (título e
 * tópicos), o cuidado a tomar, e só então o detalhe e os passos.
 */
export function AvisosView({ avisos, ehAdmin }: { avisos: Aviso[]; ehAdmin: boolean }) {
  const [primeiro, ...anteriores] = avisos;
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
      {!primeiro ? (
        <EmptyState
          title="Nenhum aviso ainda."
          description={ehAdmin ? "Publique o primeiro em Aviso com IA ou Novo aviso." : "Quando sair um anúncio importante, ele aparece aqui."}
        />
      ) : (
        <div className="space-y-6">
          <CardAviso aviso={primeiro} ehAdmin={ehAdmin} destaque />
          {anteriores.length > 0 ? (
            <section aria-labelledby="avisos-anteriores">
              <h2 id="avisos-anteriores" className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                Anteriores
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {anteriores.map((aviso) => (
                  <li key={aviso.id} className="[&>article]:h-full">
                    <CardAviso aviso={aviso} ehAdmin={ehAdmin} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

function Prazo({ prazo }: { prazo: string }) {
  const { hoje } = useDados();
  const faltam = daysBetween(hoje, prazo);
  const texto = faltam < 0 ? "encerrado" : faltam === 0 ? "termina hoje" : faltam === 1 ? "termina amanhã" : `faltam ${faltam} dias`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        faltam < 0
          ? "border-border text-muted-foreground line-through decoration-muted-foreground/50"
          : faltam <= 3
            ? "border-caution/50 bg-caution/10 text-caution"
            : "border-border text-foreground",
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden="true" />
      {formatDateShort(prazo)} · {texto}
    </span>
  );
}

const linhas = (texto: string | null) => (texto ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

function CardAviso({ aviso, ehAdmin, destaque = false }: { aviso: Aviso; ehAdmin: boolean; destaque?: boolean }) {
  const { acoes } = useDados();
  const postOficial = urlExterna(aviso.postOficialX);
  // O link oficial costuma ser o próprio post do X: aí fica só o "Post oficial".
  const link = urlExterna(aviso.link) === postOficial ? null : urlExterna(aviso.link);
  const destaques = linhas(aviso.destaques);
  const passos = linhas(aviso.acao);
  const anuncio = postAnuncioDoAviso({
    chamada: aviso.chamadaX,
    projeto: aviso.projeto,
    destaques,
    alerta: aviso.alerta,
    perfilProjeto: aviso.perfilX,
    postOficialX: postOficial,
    link,
  });
  const nome = aviso.projeto ?? "Aviso";

  return (
    <article className={cn("bg-card border-border flex flex-col rounded-xl border", destaque ? "p-6 sm:p-7" : "p-5")}>
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "bg-brand/15 text-brand-legivel flex shrink-0 items-center justify-center rounded-lg font-semibold",
            destaque ? "size-11 text-lg" : "size-9 text-sm",
          )}
        >
          {nome.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold">{nome}</span>
            {aviso.ticker ? (
              <span className="border-border text-muted-foreground rounded border px-1.5 py-px font-mono text-[11px]">${aviso.ticker}</span>
            ) : null}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatarQuando(aviso.publicadoEm)}
            {aviso.atualizadoEm ? " · editado" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {aviso.prazo ? <Prazo prazo={aviso.prazo} /> : null}
          {ehAdmin ? (
            <>
              <NovoAviso
                editarId={aviso.id}
                inicial={{
                  titulo: aviso.titulo,
                  resumo: aviso.resumo,
                  acao: aviso.acao ?? "",
                  prazo: aviso.prazo ?? "",
                  link: aviso.link ?? "",
                  projeto: aviso.projeto ?? "",
                  perfilX: aviso.perfilX ?? "",
                  chamadaX: aviso.chamadaX ?? "",
                  destaques: aviso.destaques ?? "",
                  ticker: aviso.ticker ?? "",
                  alerta: aviso.alerta ?? "",
                  postOficialX: aviso.postOficialX ?? "",
                }}
              />
              <ConfirmarExclusao
                titulo="Excluir aviso"
                alvo={aviso.titulo}
                aoConfirmar={() => acoes.excluirAviso(aviso.id)}
                gatilho={<BotaoLixeira rotulo={`Excluir aviso ${aviso.titulo}`} />}
              />
            </>
          ) : null}
        </div>
      </header>

      <h3 className={cn("mt-4 leading-snug font-semibold tracking-tight text-balance", destaque ? "text-2xl" : "text-lg")}>
        {aviso.titulo}
      </h3>

      {destaques.length > 0 ? (
        <ul className={cn("mt-3 space-y-2", destaque ? "text-base" : "text-sm")}>
          {destaques.map((d) => (
            <li key={d} className="flex gap-2.5">
              <ArrowRight className="text-brand-legivel mt-[0.3em] size-4 shrink-0" aria-hidden="true" />
              <span className="leading-relaxed">{d}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {aviso.alerta ? (
        <p className="border-caution/40 bg-caution/10 mt-4 flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm">
          <ShieldAlert className="text-caution mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{aviso.alerta}</span>
        </p>
      ) : null}

      <p className="text-muted-foreground mt-4 max-w-[70ch] text-sm leading-relaxed whitespace-pre-line">{aviso.resumo}</p>

      {passos.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium tracking-wider uppercase">O que fazer</p>
          <ol className="mt-2 space-y-2 text-sm">
            {passos.map((p, i) => (
              <li key={p} className="flex gap-2.5">
                <span className="bg-secondary flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <footer className="border-border mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Anúncio oficial
          </a>
        ) : null}
        {postOficial ? (
          <a
            href={postOficial}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:ml-3"
          >
            <IconeX className="size-3.5" />
            Post oficial
          </a>
        ) : null}
        <span className="ml-auto">
          <CompartilharAvisoX anuncio={anuncio} />
        </span>
      </footer>
    </article>
  );
}
