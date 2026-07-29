import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { CapitalPorProjetoChart } from "@/components/capital-chart";
import { Money, Percent } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ProjectStatusBadge, UrgencyBadge } from "@/components/status-badge";
import { getCapitalPorProjeto, getDashboardSummary } from "@/db/queries/dashboard";
import { listProjects } from "@/db/queries/projects";
import { listPendingTasks } from "@/db/queries/tasks";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { HOJE } from "@/db/queries/fixtures";

export default async function DashboardPage() {
  const [resumo, capital, projetos, tarefas] = await Promise.all([
    getDashboardSummary(),
    getCapitalPorProjeto(),
    listProjects(),
    listPendingTasks(),
  ]);

  const urgentes = tarefas.filter(
    (t) => t.urgencia === "atrasada" || t.urgencia === "hoje",
  );
  const semSaldo = resumo.paresTotal - resumo.paresComSaldo;

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Posição consolidada em ${formatDateBr(HOJE)}.`}
      />

      {/* Indicadores. Ordem: quanto entrou, onde está, o que sobrou, o que fazer. */}
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Capital aportado"
          accent="primary"
          value={<Money value={resumo.aportado} />}
          hint={`${resumo.projetosAtivos} projetos ativos · ${resumo.contasAtivas} contas`}
        />
        <StatCard
          label="Exposição atual"
          accent="idle"
          value={<Money value={resumo.exposicao} />}
          hint={
            semSaldo > 0
              ? `${resumo.paresComSaldo} de ${resumo.paresTotal} contas com saldo confirmado`
              : "Todas as contas com saldo confirmado"
          }
        />
        <StatCard
          label="Resultado"
          accent={resumo.resultado >= 0 ? "positive" : "negative"}
          value={<Money value={resumo.resultado} tone="auto" signed />}
          hint={
            <span className="inline-flex items-center gap-1.5">
              ROI <Percent value={resumo.roi} />
            </span>
          }
        />
        <StatCard
          label="Tarefas pendentes"
          accent={resumo.tarefasAtrasadas > 0 ? "negative" : "caution"}
          value={<span className="tabular">{urgentes.length}</span>}
          hint={
            resumo.tarefasAtrasadas > 0
              ? `${resumo.tarefasAtrasadas} atrasadas · ${resumo.tarefasHoje} para hoje`
              : `${resumo.tarefasHoje} para hoje`
          }
        />
      </section>

      {semSaldo > 0 ? (
        <p className="border-caution/30 bg-caution/5 text-muted-foreground mt-4 flex items-start gap-2 rounded-md border px-4 py-3 text-sm">
          <TriangleAlert
            className="text-caution mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            <strong className="text-foreground font-medium">
              {semSaldo} {semSaldo === 1 ? "conta está" : "contas estão"} sem saldo
              confirmado.
            </strong>{" "}
            A exposição dessas contas usa o valor aportado como estimativa, então o
            resultado acima é otimista até você registrar o saldo real.
          </span>
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        {/* -------------------------------------------------- o que fazer hoje */}
        <section aria-labelledby="titulo-tarefas">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="titulo-tarefas" className="text-lg font-medium">
              O que fazer hoje
            </h2>
            <Link
              href="/tarefas"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              Ver todas
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          {urgentes.length === 0 ? (
            <div className="border-border rounded-lg border border-dashed px-6 py-10 text-center">
              <p className="text-sm font-medium">Nada pendente para hoje.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                As próximas tarefas aparecem aqui conforme vencem.
              </p>
            </div>
          ) : (
            <ul className="border-border divide-border divide-y rounded-lg border">
              {urgentes.slice(0, 6).map((tarefa) => (
                <li
                  key={tarefa.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tarefa.titulo}</p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      <Link
                        href={`/projetos/${tarefa.projetoSlug}`}
                        className="hover:text-foreground underline-offset-2 hover:underline"
                      >
                        {tarefa.projetoNome}
                      </Link>
                      {" · "}
                      {tarefa.contaLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      {relativeLabel(tarefa.vencimento, HOJE)}
                    </span>
                    <UrgencyBadge urgency={tarefa.urgencia} />
                  </div>
                </li>
              ))}
              {urgentes.length > 6 ? (
                <li className="text-muted-foreground px-4 py-2.5 text-xs">
                  e mais {urgentes.length - 6}…
                </li>
              ) : null}
            </ul>
          )}
        </section>

        {/* --------------------------------------------------- onde está o capital */}
        <section aria-labelledby="titulo-capital">
          <h2 id="titulo-capital" className="mb-4 text-lg font-medium">
            Onde está o capital
          </h2>
          <CapitalPorProjetoChart data={capital} />
        </section>
      </div>

      {/* ------------------------------------------------------------- projetos */}
      <section aria-labelledby="titulo-projetos" className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="titulo-projetos" className="text-lg font-medium">
            Projetos
          </h2>
          <Link
            href="/projetos"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            Ver todos
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-160 text-sm">
            <caption className="sr-only">
              Resumo financeiro de cada projeto
            </caption>
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs">
                <th scope="col" className="px-4 py-2.5 font-medium">Projeto</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Aportado</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Exposição</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Resultado</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Contas</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {projetos.map((projeto) => (
                <tr key={projeto.id} className="hover:bg-accent/40 transition-colors">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <Link
                      href={`/projetos/${projeto.slug}`}
                      className="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {projeto.nome}
                    </Link>
                    {projeto.chain ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {projeto.chain}
                      </span>
                    ) : null}
                  </th>
                  <td className="px-4 py-3">
                    <ProjectStatusBadge status={projeto.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={projeto.aportado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={projeto.exposicao} tone="muted" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={projeto.resultado} tone="auto" signed />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular">
                    {projeto.contas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
