"use client";

import { useState } from "react";
import { ExternalLink, Radio, Repeat } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { BotaoLixeira, ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { EditarLive, NovaLive } from "@/components/forms/live";
import { EmptyState, PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { formatarQuando, type Live, type Ocorrencia } from "@/lib/lives";

const formatoDia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
});
const formatoMes = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  month: "short",
});
const formatoSemana = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
});

const semPonto = (s: string) => s.replace(".", "");

/**
 * Comunidade: o que a Level Cripto compartilha com todo mundo.
 *
 * Diferente do resto do app, que é a carteira de cada um, aqui o conteúdo é o
 * mesmo para todos e só quem administra escreve. Os botões de administração
 * só aparecem para quem administra, mas a trava de verdade é a das Server
 * Actions (`exigirAdministrador`).
 */
export function ComunidadeView({
  lives,
  ocorrencias,
  ehAdmin,
}: {
  lives: Live[];
  ocorrencias: Ocorrencia[];
  ehAdmin: boolean;
}) {
  return (
    <>
      <PageHeader
        icon={Radio}
        title="Comunidade"
        description="Lives da comunidade Level Cripto. Horários de Brasília."
        actions={ehAdmin ? <NovaLive /> : null}
      />

      <section aria-labelledby="titulo-lives">
        <h2 id="titulo-lives" className="mb-4 text-lg font-medium">
          Próximas lives
        </h2>
        {ocorrencias.length === 0 ? (
          <EmptyState
            title="Nenhuma live marcada para os próximos 14 dias."
            description={
              ehAdmin
                ? "Cadastre a próxima em Nova live: ela aparece aqui e na Visão geral."
                : "Quando a próxima for marcada, ela aparece aqui e na Visão geral."
            }
          />
        ) : (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {ocorrencias.map((o) => (
              <ItemDaAgenda key={`${o.liveId}-${o.quando}`} ocorrencia={o} />
            ))}
          </ul>
        )}
      </section>

      {ehAdmin ? <GerenciarLives lives={lives} /> : null}
    </>
  );
}

function ItemDaAgenda({ ocorrencia: o }: { ocorrencia: Ocorrencia }) {
  const data = new Date(o.quando);
  return (
    // No celular o link desce para baixo do texto, alinhado a ele, em vez de
    // espremer o título ao lado.
    <li className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:flex-nowrap">
      {/* O dia em destaque é o que se procura numa agenda; o resto é detalhe. */}
      <div
        className="border-border bg-secondary/40 flex w-14 shrink-0 flex-col items-center rounded-md border py-1.5"
        aria-hidden="true"
      >
        <span className="text-muted-foreground text-[11px] uppercase">
          {semPonto(formatoSemana.format(data))}
        </span>
        <span className="text-lg leading-tight font-semibold tabular-nums">
          {formatoDia.format(data)}
        </span>
        <span className="text-muted-foreground text-[11px] uppercase">
          {semPonto(formatoMes.format(data))}
        </span>
      </div>

      <div className="min-w-0 shrink grow basis-[calc(100%-4.5rem)] sm:basis-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{o.titulo}</p>
          {o.aoVivo ? (
            <span className="border-caution/40 bg-caution/10 text-caution inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
              <span className="bg-caution size-1.5 rounded-full motion-safe:animate-pulse" aria-hidden="true" />
              Ao vivo
            </span>
          ) : null}
          {o.semanal ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Repeat className="size-3" aria-hidden="true" />
              Toda semana
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm">{formatarQuando(o.quando)}</p>
        {o.descricao ? <p className="mt-2 text-sm">{o.descricao}</p> : null}
      </div>

      {o.link ? (
        <a
          href={o.link}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "border-border hover:border-brand/50 focus-visible:ring-ring ml-[4.5rem] inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none sm:ml-0",
            o.aoVivo && "border-caution/50",
          )}
        >
          {o.aoVivo ? "Assistir agora" : "Abrir link"}
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      ) : null}
    </li>
  );
}

/**
 * Lista de administração: as lives como foram cadastradas, inclusive as que
 * já passaram, que a agenda acima não mostra mais e que só daqui dá para
 * apagar.
 */
function GerenciarLives({ lives }: { lives: Live[] }) {
  const { acoes } = useDados();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <section aria-labelledby="titulo-gerenciar" className="mt-10">
      <h2 id="titulo-gerenciar" className="mb-1 text-lg font-medium">
        Lives cadastradas
      </h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Só quem administra vê esta lista. Uma live semanal continua se repetindo até ser
        excluída.
      </p>

      {erro ? (
        <p
          role="alert"
          className="border-negative/30 bg-negative/5 text-negative mb-4 rounded-md border px-3 py-2 text-sm"
        >
          {erro}
        </p>
      ) : null}

      {lives.length === 0 ? (
        <EmptyState title="Nenhuma live cadastrada." description="Use Nova live, no topo." />
      ) : (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {lives.map((live) => (
            <li key={live.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{live.titulo}</p>
                <p className="text-muted-foreground text-xs">
                  {live.semanal ? "Toda semana, desde " : "Em "}
                  {formatarQuando(live.inicioEm)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <EditarLive live={live} />
                <ConfirmarExclusao
                  titulo="Excluir live"
                  alvo={live.titulo}
                  impacto={live.semanal ? "todas as próximas semanas dela" : null}
                  aoConfirmar={async () => {
                    const falha = await acoes.excluirLive(live.id);
                    setErro(falha ? (Object.values(falha)[0] ?? "Não foi possível excluir.") : null);
                  }}
                  gatilho={<BotaoLixeira rotulo={`Excluir ${live.titulo}`} />}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
