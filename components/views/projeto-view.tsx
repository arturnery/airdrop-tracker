"use client";

import Link from "next/link";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { useDados } from "@/components/data-provider";
import {
  NovaMeta,
  NovaTarefa,
  NovoLancamento,
  RegistrarRecebimento,
  RegistrarSaldo,
  VincularConta,
} from "@/components/forms/dialogs";
import { Money, Percent } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  AccountStatusBadge,
  PriorityMeter,
  ProjectStatusBadge,
  RecurrenceLabel,
  UrgencyBadge,
} from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import { selectProjectBySlug, selectTasksByProject } from "@/lib/selectors";
import type { TransactionRow } from "@/lib/types";

const tipoLabels: Record<TransactionRow["tipo"], string> = {
  deposit: "Depósito",
  withdrawal: "Retirada",
  trade_pnl: "Resultado de trade",
  fee_gas: "Taxa / gas",
  volume_traded: "Volume operado",
  other: "Outro",
};

export function ProjetoView({ slug }: { slug: string }) {
  const { dataset, hoje } = useDados();
  const projeto = selectProjectBySlug(dataset, slug, hoje);

  if (!projeto) {
    return (
      <>
        <PageHeader title="Projeto não encontrado" />
        <EmptyState
          title="Esse projeto não existe"
          description="Ele pode ter sido removido, ou o endereço está errado."
          action={
            <Link
              href="/projetos"
              className="text-primary text-sm underline underline-offset-4"
            >
              Voltar para projetos
            </Link>
          }
        />
      </>
    );
  }

  const tarefas = selectTasksByProject(dataset, projeto.id, hoje);
  const semSaldo = projeto.contasDetalhe.filter((c) => c.saldo === null);
  const links = [
    { href: projeto.links.website, label: "Site" },
    { href: projeto.links.docs, label: "Docs" },
    { href: projeto.links.twitter, label: "Twitter" },
    { href: projeto.links.discord, label: "Discord" },
  ].filter((l): l is { href: string; label: string } => Boolean(l.href));

  return (
    <>
      <nav aria-label="Trilha" className="text-muted-foreground mb-4 text-sm">
        <Link
          href="/projetos"
          className="focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Projetos
        </Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span className="text-foreground">{projeto.nome}</span>
      </nav>

      <PageHeader
        title={projeto.nome}
        description={
          [
            projeto.chain,
            `${projeto.contas} ${projeto.contas === 1 ? "conta" : "contas"}`,
            projeto.tgePrevisto
              ? `TGE previsto ${formatDateBr(projeto.tgePrevisto)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PriorityMeter value={projeto.prioridade} />
            <ProjectStatusBadge status={projeto.status} />
            <NovoLancamento projectId={projeto.id} rotulo="Lançamento" />
          </div>
        }
      />

      <section
        aria-label="Indicadores do projeto"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Aportado"
          accent="primary"
          value={<Money value={projeto.aportado} />}
        />
        <StatCard
          label="Exposição"
          accent="idle"
          value={<Money value={projeto.exposicao} />}
          hint={
            semSaldo.length > 0
              ? `${projeto.contas - semSaldo.length} de ${projeto.contas} confirmadas`
              : "Todas confirmadas"
          }
        />
        <StatCard
          label="Resultado"
          accent={projeto.resultado >= 0 ? "positive" : "negative"}
          value={<Money value={projeto.resultado} tone="auto" signed />}
          hint={
            <span className="inline-flex items-center gap-1.5">
              ROI <Percent value={projeto.roi} />
            </span>
          }
        />
        <StatCard
          label="Tarefas pendentes"
          accent={projeto.tarefasAtrasadas > 0 ? "negative" : "caution"}
          value={<span className="tabular">{projeto.tarefasPendentes}</span>}
          hint={
            projeto.tarefasAtrasadas > 0
              ? `${projeto.tarefasAtrasadas} atrasadas`
              : "nenhuma atrasada"
          }
        />
      </section>

      <Tabs defaultValue="contas" className="mt-10">
        <TabsList>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="airdrop">Airdrop</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------- contas */}
        <TabsContent value="contas" className="mt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <VincularConta projectId={projeto.id} />
            <RegistrarSaldo projectId={projeto.id} />
          </div>

          {projeto.contasDetalhe.length === 0 ? (
            <EmptyState
              title="Nenhuma conta vinculada"
              description="Vincule as contas que estão farmando este projeto para acompanhar cada uma separadamente."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-160 text-sm">
                <caption className="sr-only">
                  Situação de cada conta neste projeto
                </caption>
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left text-xs">
                    <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Situação</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Aportado</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Saldo</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Resultado</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Pendências</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {projeto.contasDetalhe.map((conta) => (
                    <tr
                      key={conta.contaId}
                      className="hover:bg-accent/40 transition-colors"
                    >
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {conta.label}
                      </th>
                      <td className="px-4 py-3">
                        <AccountStatusBadge status={conta.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Money value={conta.aportado} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {conta.saldo === null ? (
                          <span
                            className="text-caution inline-flex items-center gap-1.5 text-xs"
                            title="Nenhum saldo registrado para esta conta"
                          >
                            <TriangleAlert className="size-3.5" aria-hidden="true" />
                            não confirmado
                          </span>
                        ) : (
                          <span className="inline-flex flex-col items-end">
                            <Money value={conta.saldo} />
                            {conta.saldoEm ? (
                              <span className="text-muted-foreground text-xs">
                                {relativeLabel(conta.saldoEm, hoje)}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {conta.resultado === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Money value={conta.resultado} tone="auto" signed />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {conta.tarefasPendentes > 0 ? (
                          <span className="tabular">{conta.tarefasPendentes}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {semSaldo.length > 0 ? (
            <p className="text-muted-foreground mt-3 text-xs">
              {semSaldo.length}{" "}
              {semSaldo.length === 1 ? "conta ainda não tem" : "contas ainda não têm"}{" "}
              saldo registrado; para elas a exposição usa o valor aportado como
              estimativa.
            </p>
          ) : null}
        </TabsContent>

        {/* -------------------------------------------------------- histórico */}
        <TabsContent value="historico" className="mt-6">
          {projeto.historico.length === 0 ? (
            <EmptyState
              title="Nenhum lançamento ainda"
              description="Depósitos, retiradas e saldos registrados aparecem aqui em ordem cronológica."
            />
          ) : (
            <>
              <div className="border-border overflow-x-auto rounded-lg border">
                <table className="w-full min-w-160 text-sm">
                  <caption className="sr-only">
                    Histórico de lançamentos do projeto
                  </caption>
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs">
                      <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Tipo</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Descrição</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {projeto.historico.map((linha) => (
                      <tr
                        key={linha.id}
                        className="hover:bg-accent/40 transition-colors"
                      >
                        <td className="text-muted-foreground tabular px-4 py-3">
                          {formatDateBr(linha.data)}
                        </td>
                        <td className="px-4 py-3">{linha.contaLabel}</td>
                        <td className="px-4 py-3">
                          {linha.isSnapshot ? (
                            <span className="text-muted-foreground border-border rounded border px-1.5 py-0.5 text-xs">
                              Saldo
                            </span>
                          ) : (
                            <span className="text-xs">{tipoLabels[linha.tipo]}</span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs">
                          {linha.descricao ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Money
                            value={linha.valor}
                            tone={linha.isSnapshot ? "muted" : "neutral"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Linhas marcadas como{" "}
                <strong className="text-foreground">Saldo</strong> são fotos do saldo,
                não movimentação — por isso não entram na soma de capital aportado.
              </p>
            </>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------- tarefas */}
        <TabsContent value="tarefas" className="mt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <NovaTarefa projectId={projeto.id} />
            <NovaMeta projectId={projeto.id} />
          </div>

          {tarefas.length === 0 ? (
            <EmptyState
              title="Nenhuma tarefa pendente"
              description="Tarefas recorrentes e prazos deste projeto aparecem aqui."
            />
          ) : (
            <ul className="border-border divide-border divide-y rounded-lg border">
              {tarefas.map((tarefa) => (
                <li
                  key={tarefa.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tarefa.titulo}</p>
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                      <span>{tarefa.contaLabel}</span>
                      <span aria-hidden="true">·</span>
                      <RecurrenceLabel recurrence={tarefa.recorrencia} />
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      {relativeLabel(tarefa.vencimento, hoje)}
                    </span>
                    <UrgencyBadge urgency={tarefa.urgencia} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {projeto.metas.length > 0 ? (
            <section className="mt-8">
              <h3 className="mb-3 text-sm font-medium">Metas</h3>
              <ul className="space-y-4">
                {projeto.metas.map((meta) => {
                  const pct =
                    meta.alvo > 0
                      ? Math.min(Math.round((meta.atual / meta.alvo) * 100), 100)
                      : 0;
                  return (
                    <li key={meta.id} className="border-border rounded-lg border p-4">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="text-sm">
                          {meta.titulo}
                          {meta.contaLabel ? (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {meta.contaLabel}
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular text-sm">
                          {formatUsd(meta.atual)}
                          <span className="text-muted-foreground">
                            {" / "}
                            {formatUsd(meta.alvo)}
                          </span>
                        </span>
                      </div>
                      <div className="bg-secondary h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-chart-1 h-full rounded-full"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {pct}% da meta
                        {meta.prazo ? ` · prazo ${formatDateBr(meta.prazo)}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </TabsContent>

        {/* ---------------------------------------------------------- airdrop */}
        <TabsContent value="airdrop" className="mt-6">
          <div className="mb-4">
            <RegistrarRecebimento projectId={projeto.id} />
          </div>

          {projeto.recebimentos.length === 0 ? (
            <EmptyState
              title="O airdrop ainda não caiu"
              description="Quando o token for distribuído, registre aqui quanto cada conta recebeu e a que preço. É o que fecha o cálculo de ROI real do projeto."
            />
          ) : (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-160 text-sm">
                <caption className="sr-only">Tokens recebidos por conta</caption>
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left text-xs">
                    <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Token</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Quantidade</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {projeto.recebimentos.map((claim) => (
                    <tr key={claim.id}>
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {claim.contaLabel}
                      </th>
                      <td className="text-muted-foreground tabular px-4 py-3">
                        {formatDateBr(claim.recebidoEm)}
                      </td>
                      <td className="px-4 py-3">{claim.token}</td>
                      <td className="tabular px-4 py-3 text-right">
                        {claim.quantidade}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Money value={claim.valor} tone="auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- info */}
        <TabsContent value="info" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="border-border rounded-lg border p-5">
              <h3 className="mb-4 text-sm font-medium">Dados do projeto</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Rede</dt>
                  <dd>{projeto.chain ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><ProjectStatusBadge status={projeto.status} /></dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Prioridade</dt>
                  <dd><PriorityMeter value={projeto.prioridade} /></dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">TGE previsto</dt>
                  <dd className="tabular">
                    {projeto.tgePrevisto ? formatDateBr(projeto.tgePrevisto) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Última atividade</dt>
                  <dd className="tabular">
                    {projeto.ultimaAtividade
                      ? formatDateBr(projeto.ultimaAtividade)
                      : "—"}
                  </dd>
                </div>
              </dl>

              {links.length > 0 ? (
                <div className="border-border mt-5 border-t pt-4">
                  <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                    Links
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="border-border hover:border-primary/50 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {link.label}
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="border-border rounded-lg border p-5">
              <h3 className="mb-3 text-sm font-medium">Anotações</h3>
              {projeto.notas ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {projeto.notas}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Sem anotações. Use este espaço para registrar a tese do projeto e a
                  estratégia de farming.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
