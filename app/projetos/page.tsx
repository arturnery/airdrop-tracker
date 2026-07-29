import Link from "next/link";

import { Money, Percent } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { PriorityMeter, ProjectStatusBadge } from "@/components/status-badge";
import { listProjects } from "@/db/queries/projects";
import { HOJE } from "@/db/queries/fixtures";
import { formatDateShort, relativeLabel } from "@/lib/dates";

export const metadata = { title: "Projetos · airdrop-tracker" };

export default async function ProjetosPage() {
  const projetos = await listProjects();

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Ordenados por prioridade. Clique para abrir a aba do projeto."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {projetos.map((projeto) => (
          <article
            key={projeto.id}
            className="bg-card border-border hover:border-primary/40 rounded-lg border p-5 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-medium">
                  <Link
                    href={`/projetos/${projeto.slug}`}
                    className="focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
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
                    title={`Última atividade ${relativeLabel(projeto.ultimaAtividade, HOJE)}`}
                  >
                    {formatDateShort(projeto.ultimaAtividade)}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
