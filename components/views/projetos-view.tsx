"use client";

import Link from "next/link";

import { useDados } from "@/components/data-provider";
import { NovoProjeto } from "@/components/forms/dialogs";
import { Money, Percent } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PriorityMeter, ProjectStatusBadge } from "@/components/status-badge";
import { formatDateShort, relativeLabel } from "@/lib/dates";
import { selectProjects } from "@/lib/selectors";

export function ProjetosView() {
  const { dataset, hoje } = useDados();
  const projetos = selectProjects(dataset, hoje);

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Ordenados por prioridade. Clique no card para abrir o projeto."
        actions={<NovoProjeto />}
      />

      {projetos.length === 0 ? (
        <EmptyState
          title="Nenhum projeto cadastrado"
          description="Cadastre o primeiro airdrop que você está farmando para começar a acompanhar capital e tarefas."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projetos.map((projeto) => (
            /*
             * Card inteiro clicável via "stretched link": o <Link> continua
             * sendo um único link real (bom para teclado e leitor de tela),
             * mas seu ::after cobre o card todo. Envolver o card no <Link>
             * aninharia os links internos, o que é HTML inválido.
             */
            <article
              key={projeto.id}
              className="group bg-card border-border hover:border-primary/40 focus-within:border-primary/60 relative rounded-lg border p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-medium">
                    <Link
                      href={`/projetos/${projeto.slug}`}
                      className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
                    >
                      {projeto.nome}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {projeto.chain ?? "rede não informada"}
                    {" · "}
                    {projeto.contas} {projeto.contas === 1 ? "conta" : "contas"}
                  </p>
                </div>
                <ProjectStatusBadge status={projeto.status} />
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Aportado</dt>
                  <dd className="mt-0.5">
                    <Money value={projeto.aportado} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Exposição</dt>
                  <dd className="mt-0.5">
                    <Money value={projeto.exposicao} tone="muted" />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Resultado</dt>
                  <dd className="mt-0.5 flex items-baseline gap-1.5">
                    <Money value={projeto.resultado} tone="auto" signed />
                    <Percent value={projeto.roi} className="text-xs" />
                  </dd>
                </div>
              </dl>

              <div className="border-border mt-5 flex items-center justify-between gap-3 border-t pt-4">
                <PriorityMeter value={projeto.prioridade} />
                <div className="flex items-center gap-3 text-xs">
                  {projeto.tarefasAtrasadas > 0 ? (
                    <span className="text-negative font-medium">
                      {projeto.tarefasAtrasadas} atrasada
                      {projeto.tarefasAtrasadas > 1 ? "s" : ""}
                    </span>
                  ) : projeto.tarefasPendentes > 0 ? (
                    <span className="text-muted-foreground">
                      {projeto.tarefasPendentes} pendente
                      {projeto.tarefasPendentes > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">sem pendências</span>
                  )}
                  {projeto.ultimaAtividade ? (
                    <span
                      className="text-muted-foreground"
                      title={`Última atividade ${relativeLabel(projeto.ultimaAtividade, hoje)}`}
                    >
                      {formatDateShort(projeto.ultimaAtividade)}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
