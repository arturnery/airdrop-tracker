"use client";

import { useState } from "react";

import Link from "next/link";
import { ExternalLink, Unlink } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { FiltroChips } from "@/components/filtro-chips";
import {
  BotaoLixeira,
  ConfirmarExclusao,
} from "@/components/forms/confirmar-exclusao";
import {
  EditarLancamento,
  EditarMeta,
  EditarProjeto,
  EditarTarefa,
  EditarVinculo,
} from "@/components/forms/editar";
import { Ajuda, explicacoes } from "@/components/ajuda";
import { faltaRegistrarRecebimento } from "@/lib/consistencia";
import { AvisoSaldo } from "@/components/aviso-saldo";
import { Button } from "@/components/ui/button";
import {
  LancarProgressoMeta,
  RegistrarVolume,
  NovaMeta,
  NovaTarefa,
  NovoLancamento,
  RegistrarPontos,
  RegistrarRecebimento,
  VincularConta,
} from "@/components/forms/dialogs";
import { Money, Percent } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  AccountStatusBadge,
  CategoryBadge,
  categoryDescriptions,
  nomeRiscado,
  PriorityMeter,
  ProjectStatusBadge,
  RecurrenceLabel,
  UrgencyBadge,
} from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import {
  contarDependenciasVinculo,
  descreverImpacto,
  selectHistoricoDePontos,
  selectProgramaDePontos,
  selectVolumeDoProjeto,
  selectProjectBySlug,
  selectTasksByProject,
} from "@/lib/selectors";
import { formatPoints, formatPointsDelta, ZERO_PONTOS } from "@/lib/points";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/lib/types";

const tipoLabels: Record<TransactionRow["tipo"], string> = {
  deposit: "Depósito",
  withdrawal: "Retirada",
  yield: "Rendimento",
  trade_pnl: "Resultado de trade",
  fee_gas: "Taxa / gas",
  volume_traded: "Volume operado",
  other: "Outro",
};

export function ProjetoView({ slug }: { slug: string }) {
  /*
   * Filtro do histórico por tipo. Nasceu de um pedido para dar aba própria ao
   * volume operado: uma aba por tipo daria sete, e o filtro resolve o mesmo
   * problema para todos, inclusive os que ainda não existem.
   */
  const [tipoFiltro, setTipoFiltro] = useState<TransactionRow["tipo"] | null>(
    null,
  );
  const { dataset, hoje, acoes } = useDados();
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
              className="text-brand-legivel text-sm underline underline-offset-4"
            >
              Voltar para projetos
            </Link>
          }
        />
      </>
    );
  }

  const tarefas = selectTasksByProject(dataset, projeto.id, hoje);
  const programa = selectProgramaDePontos(dataset, projeto.id);
  const volume = selectVolumeDoProjeto(dataset, projeto.id);
  const historicoPontos = programa
    ? selectHistoricoDePontos(dataset, projeto.id)
    : [];

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
        <span className={cn("text-foreground", nomeRiscado(projeto.status))}>
          {projeto.nome}
        </span>
      </nav>

      <PageHeader
        title={projeto.nome}
        titleClassName={nomeRiscado(projeto.status)}
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
            <CategoryBadge category={projeto.categoria} />
            <PriorityMeter value={projeto.prioridade} />
            <ProjectStatusBadge status={projeto.status} />
            <EditarProjeto projectId={projeto.id} />
            <NovoLancamento projectId={projeto.id} rotulo="Lançamento" />
          </div>
        }
      />

      {/*
        O aviso vem antes dos indicadores, e não depois: quem lê o número
        primeiro e o aviso depois já tirou a conclusão errada no caminho.
      */}
      {projeto.alerta ? (
        <AvisoSaldo alerta={projeto.alerta} className="mb-6" />
      ) : null}

      {/*
        Cinco colunas quando há volume operado, quatro quando não há. O volume
        não é dinheiro movimentado (não entra em saldo nem em resultado), então
        antes ele não tinha onde aparecer dentro do projeto: ficava só como uma
        linha no histórico, perdido entre depósitos e retiradas.
        Em projetos que qualificam por atividade, ele é o número que importa.
      */}
      <section
        aria-label="Indicadores do projeto"
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          projeto.volumeOperado > 0 ? "xl:grid-cols-5" : "xl:grid-cols-4",
        )}
      >
        <StatCard
          label="Capital depositado"
          accent="primary"
          ajuda={explicacoes.capital}
          value={<Money value={projeto.capitalNoPico} />}
          hint="máximo empregado ao mesmo tempo"
        />
        <StatCard
          label="Exposição"
          accent="idle"
          ajuda={explicacoes.exposicao}
          value={<Money value={projeto.exposicao} />}
          hint={projeto.alerta ? projeto.alerta.resumo : "o que está lá agora"}
        />
        <StatCard
          label="Resultado"
          accent={projeto.resultado >= 0 ? "positive" : "negative"}
          ajuda={explicacoes.resultado}
          value={<Money value={projeto.resultado} tone="auto" signed />}
          hint={
            /*
             * A base aparece junto do percentual: evita a pergunta "por cima de
             * quanto?", e é o número que explica um ROI alto num projeto de
             * aporte pequeno. A conta exata fica na interrogação do cartão.
             */
            projeto.roi === null ? null : (
              <span className="inline-flex items-center gap-1.5">
                ROI <Percent value={projeto.roi} />
                <span className="text-muted-foreground">
                  sobre <Money value={projeto.capitalNoPico} /> depositado
                </span>
              </span>
            )
          }
        />
        {projeto.volumeOperado > 0 ? (
          <StatCard
            label="Volume operado"
          ajuda={explicacoes.volume}
            accent="idle"
            value={<Money value={projeto.volumeOperado} />}
            hint="atividade, não dinheiro movimentado"
          />
        ) : null}
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
          <TabsTrigger value="metas">Metas</TabsTrigger>
          {programa ? (
            <TabsTrigger value="pontos">{programa.rotulo}</TabsTrigger>
          ) : null}
          {/* Só existe se houver volume: aba vazia é promessa não cumprida. */}
          {volume.total > 0 ? (
            <TabsTrigger value="volume">Volume</TabsTrigger>
          ) : null}
          <TabsTrigger value="airdrop">Airdrop</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------- contas */}
        <TabsContent value="contas" className="mt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <VincularConta projectId={projeto.id} />
          </div>

          {projeto.posicoesToken.length > 0 ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {projeto.posicoesToken.map((posicao) => (
                <div
                  key={posicao.symbol}
                  className="bg-card border-border rounded-lg border p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {posicao.quantidade} {posicao.symbol}
                    </span>
                    {posicao.precoUsd === null ? (
                      <Link
                        href="/cotacoes"
                        className="text-caution text-xs underline underline-offset-4"
                      >
                        informar cotação
                      </Link>
                    ) : null}
                  </div>

                  <p className="font-numeric mt-2 text-2xl leading-none font-semibold">
                    <Money value={posicao.valorAtualUsd} />
                  </p>

                  {/* Entrada vs. hoje lado a lado: é a comparação que responde
                      "estou ganhando no preço do token?". */}
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Preço de entrada</dt>
                      <dd className="mt-0.5">
                        {posicao.precoMedioUsd === null ? (
                          "-"
                        ) : (
                          <Money value={posicao.precoMedioUsd} />
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Cotação hoje</dt>
                      <dd className="mt-0.5">
                        {posicao.precoUsd === null ? (
                          <span className="text-caution">não informada</span>
                        ) : (
                          <Money value={posicao.precoUsd} />
                        )}
                      </dd>
                    </div>
                  </dl>

                  <p className="border-border text-muted-foreground mt-3 border-t pt-2 text-xs">
                    aportado <Money value={posicao.investidoUsd} />
                    {posicao.valorizacao !== null ? (
                      <>
                        {" · "}
                        <Money value={posicao.valorizacao} tone="auto" signed />
                        {posicao.valorizacaoPercent !== null ? (
                          <> ({posicao.valorizacaoPercent > 0 ? "+" : ""}
                          {posicao.valorizacaoPercent.toFixed(1)}%)</>
                        ) : null}
                      </>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

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
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
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
                        <Money value={conta.saldo} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Money value={conta.resultado} tone="auto" signed />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {conta.tarefasPendentes > 0 ? (
                          <span className="tabular">{conta.tarefasPendentes}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end">
                          <EditarVinculo
                            projectId={projeto.id}
                            accountId={conta.contaId}
                          />
                          <ConfirmarExclusao
                            titulo="Desvincular conta"
                            alvo={`${conta.label} em ${projeto.nome}`}
                            impacto={descreverImpacto(
                              contarDependenciasVinculo(
                                dataset,
                                projeto.id,
                                conta.contaId,
                              ),
                            )}
                            aoConfirmar={() =>
                              acoes.desvincularConta(projeto.id, conta.contaId)
                            }
                            gatilho={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:text-negative size-8"
                                aria-label={`Desvincular ${conta.label}`}
                                title={`Desvincular ${conta.label}`}
                              >
                                <Unlink className="size-3.5" aria-hidden="true" />
                              </Button>
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-muted-foreground mt-3 text-xs">
            O saldo de cada conta é a soma dos lançamentos dela: todo valor aqui tem
            um lançamento no histórico que o explica.
          </p>
        </TabsContent>

        {/* --------------------------------------------------------- histórico */}
        <TabsContent value="historico" className="mt-6">
          {projeto.historico.length === 0 ? (
            <EmptyState
              title="Nenhum lançamento ainda"
              description="Depósitos, retiradas e saldos registrados aparecem aqui em ordem cronológica."
            />
          ) : (
            <>
              <div className="border-border mb-4 rounded-lg border p-4">
                <FiltroChips
                  legenda="Tipo de lançamento"
                  selecionado={tipoFiltro}
                  aoSelecionar={setTipoFiltro}
                  opcoes={[
                    {
                      valor: null,
                      rotulo: "Todos",
                      contagem: projeto.historico.length,
                    },
                    // Só os tipos presentes: oferecer filtro que devolve nada
                    // é ruído, e a lista de sete tipos não cabe em tela estreita.
                    ...(
                      Object.keys(tipoLabels) as TransactionRow["tipo"][]
                    ).flatMap((tipo) => {
                      const qtd = projeto.historico.filter(
                        (l) => l.tipo === tipo,
                      ).length;
                      return qtd > 0
                        ? [{ valor: tipo, rotulo: tipoLabels[tipo], contagem: qtd }]
                        : [];
                    }),
                  ]}
                />
              </div>
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
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {projeto.historico
                      .filter((l) => tipoFiltro === null || l.tipo === tipoFiltro)
                      .map((linha) => (
                      <tr
                        key={linha.id}
                        className="hover:bg-accent/40 transition-colors"
                      >
                        <td className="text-muted-foreground tabular px-4 py-3">
                          {formatDateBr(linha.data)}
                        </td>
                        <td className="px-4 py-3">{linha.contaLabel}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs">{tipoLabels[linha.tipo]}</span>
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs">
                          {linha.tokenAmount && linha.tokenSymbol ? (
                            <span className="text-foreground">
                              {linha.tokenAmount} {linha.tokenSymbol}
                            </span>
                          ) : null}
                          {linha.tokenAmount && linha.descricao ? " · " : null}
                          {linha.descricao ?? (linha.tokenAmount ? "" : "-")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Money value={linha.valor} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end">
                            <EditarLancamento transactionId={linha.id} />
                            <ConfirmarExclusao
                              titulo="Excluir lançamento"
                              alvo={`${tipoLabels[linha.tipo]} de ${linha.contaLabel} em ${formatDateBr(linha.data)}`}
                              impacto="O saldo da conta muda, porque é a soma dos lançamentos"
                              aoConfirmar={() => acoes.excluirLancamento(linha.id)}
                              gatilho={<BotaoLixeira rotulo="Excluir lançamento" />}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                O saldo do projeto é a soma destes lançamentos. Volume operado aparece
                aqui mas fica fora do caixa: é atividade, não dinheiro movimentado.
              </p>
            </>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------- tarefas */}
        <TabsContent value="tarefas" className="mt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <NovaTarefa projectId={projeto.id} />
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
                    <div className="flex items-center">
                      <EditarTarefa taskId={tarefa.taskId} />
                      <ConfirmarExclusao
                        titulo="Excluir tarefa"
                        alvo={tarefa.titulo}
                        impacto={(() => {
                          const n = dataset.taskOccurrences.filter(
                            (o) => o.taskId === tarefa.taskId,
                          ).length;
                          return n > 1 ? `${n} ocorrências dessa tarefa` : null;
                        })()}
                        aoConfirmar={() => acoes.excluirTarefa(tarefa.taskId)}
                        gatilho={<BotaoLixeira rotulo={`Excluir ${tarefa.titulo}`} />}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

        </TabsContent>

        {/* ----------------------------------------------------------- pontos */}
        {programa ? (
          <TabsContent value="pontos" className="mt-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs tracking-wider uppercase">
                  Total acumulado
                </p>
                <p className="font-numeric mt-1 text-4xl leading-none font-semibold">
                  {formatPoints(programa.total)}
                </p>
                {programa.variacao !== null ? (
                  <p className="mt-2 text-xs">
                    <span
                      className={cn(
                        "tabular font-medium",
                        programa.variacao > ZERO_PONTOS && "text-positive",
                        programa.variacao < ZERO_PONTOS && "text-negative",
                      )}
                    >
                      {formatPointsDelta(programa.variacao)}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      desde a medição anterior
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Primeira medição: registre de novo depois para ver o ganho.
                  </p>
                )}
              </div>
              <RegistrarPontos projectId={projeto.id} />
            </div>

            <h3 className="mb-3 text-sm font-medium">Por conta</h3>
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-160 text-sm">
                <caption className="sr-only">
                  Pontos acumulados por conta neste projeto
                </caption>
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left text-xs">
                    <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Acumulado</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Variação</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Observação</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Medido</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {programa.contas.map((conta) => (
                    <tr key={conta.contaId} className="hover:bg-accent/40 transition-colors">
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        {conta.label}
                      </th>
                      <td className="tabular px-4 py-3 text-right">
                        {conta.total === null ? (
                          <span className="text-muted-foreground text-xs">
                            sem registro
                          </span>
                        ) : (
                          formatPoints(conta.total)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {conta.variacao === null ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <span
                            className={cn(
                              "tabular",
                              conta.variacao > ZERO_PONTOS && "text-positive",
                              conta.variacao < ZERO_PONTOS && "text-negative",
                            )}
                          >
                            {formatPointsDelta(conta.variacao)}
                          </span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-xs">
                        {conta.nota ?? "-"}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                        {conta.atualizadoEm
                          ? relativeLabel(conta.atualizadoEm, hoje)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 mb-3 text-sm font-medium">Histórico de medições</h3>
            {historicoPontos.length === 0 ? (
              <EmptyState
                title="Nenhuma medição registrada"
                description="Registre o total acumulado periodicamente; o ganho do período sai da diferença entre duas medições."
              />
            ) : (
              <div className="border-border overflow-x-auto rounded-lg border">
                <table className="w-full min-w-160 text-sm">
                  <caption className="sr-only">Medições de pontos ao longo do tempo</caption>
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs">
                      <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Acumulado</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Ganho</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Observação</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {historicoPontos.map((registro) => (
                      <tr key={registro.id} className="hover:bg-accent/40 transition-colors">
                        <td className="text-muted-foreground tabular px-4 py-3">
                          {formatDateBr(registro.data)}
                        </td>
                        <td className="px-4 py-3">{registro.contaLabel}</td>
                        <td className="tabular px-4 py-3 text-right">
                          {formatPoints(registro.total)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {registro.variacao === null ? (
                            <span className="text-muted-foreground text-xs">
                              primeira
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "tabular",
                                registro.variacao > ZERO_PONTOS && "text-positive",
                                registro.variacao < ZERO_PONTOS && "text-negative",
                              )}
                            >
                              {formatPointsDelta(registro.variacao)}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs">
                          {registro.nota ?? "-"}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end">
                            <ConfirmarExclusao
                              titulo="Excluir medição"
                              alvo={`${formatPoints(registro.total)} ${programa.rotulo} de ${registro.contaLabel} em ${formatDateBr(registro.data)}`}
                              aoConfirmar={() => acoes.excluirPontos(registro.id)}
                              gatilho={<BotaoLixeira rotulo="Excluir medição" />}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ) : null}

        {/* ---------------------------------------------------------- airdrop */}
        <TabsContent value="metas" className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Alvos de volume, saldo ou atividade. Cada meta acumula o próprio
              progresso: lance nela o que contar para ela.
            </p>
            <NovaMeta projectId={projeto.id} />
          </div>

          {projeto.metas.length === 0 ? (
            <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-8 text-center text-sm">
              Nenhuma meta neste projeto.
            </p>
          ) : (
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
                      <span className="flex items-center gap-2">
                        <span className="tabular text-sm">
                          {formatUsd(meta.atual)}
                          <span className="text-muted-foreground">
                            {" / "}
                            {formatUsd(meta.alvo)}
                          </span>
                        </span>
                        <LancarProgressoMeta goalId={meta.id} titulo={meta.titulo} />
                        <EditarMeta goalId={meta.id} />
                        <ConfirmarExclusao
                          titulo="Excluir meta"
                          alvo={meta.titulo}
                          aoConfirmar={() => acoes.excluirMeta(meta.id)}
                          gatilho={<BotaoLixeira rotulo={`Excluir ${meta.titulo}`} />}
                        />
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
                      {meta.lancamentos.length > 0
                        ? ` · ${meta.lancamentos.length} ${
                            meta.lancamentos.length === 1
                              ? "lançamento"
                              : "lançamentos"
                          }`
                        : ""}
                    </p>

                    {/*
                      O histórico fica dobrado. Aberto, ele empurraria as outras
                      metas para fora da tela; escondido de todo, não haveria
                      como corrigir um lançamento errado sem apagar a meta.
                    */}
                    {meta.lancamentos.length > 0 ? (
                      <details className="mt-3">
                        <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex cursor-pointer rounded-sm text-xs focus-visible:ring-2 focus-visible:outline-none">
                          Ver os lançamentos
                        </summary>
                        <ul className="divide-border border-border mt-2 divide-y border-t">
                          {meta.lancamentos.map((entrada) => (
                            <li
                              key={entrada.id}
                              className="flex items-center gap-3 py-2 text-xs"
                            >
                              <span className="text-muted-foreground tabular shrink-0">
                                {formatDateBr(entrada.data)}
                              </span>
                              <span className="tabular shrink-0 font-medium">
                                {formatUsd(entrada.valor)}
                              </span>
                              <span className="text-muted-foreground min-w-0 flex-1 truncate">
                                {entrada.nota}
                              </span>
                              <ConfirmarExclusao
                                titulo="Excluir lançamento"
                                alvo={`${formatUsd(entrada.valor)} em ${meta.titulo}`}
                                aoConfirmar={() =>
                                  acoes.excluirProgressoMeta(entrada.id)
                                }
                                gatilho={
                                  <BotaoLixeira rotulo="Excluir lançamento da meta" />
                                }
                              />
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="volume" className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground max-w-xl text-sm">
              Registre o <strong className="text-foreground">total acumulado</strong>{" "}
              que a plataforma mostra, não o quanto rodou desde a última vez: a
              diferença o sistema calcula.
            </p>
            <RegistrarVolume projectId={projeto.id} />
          </div>

          {volume.atualizadoEm === null ? (
            <EmptyState
              title="Nenhuma medição de volume"
              description="Anote o volume acumulado que a plataforma mostra. Na próxima medição, o sistema mostra quanto rodou no período."
            />
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wider uppercase">
                    Volume acumulado
                    <Ajuda sobre="volume acumulado">{explicacoes.volume}</Ajuda>
                  </p>
                  <p className="font-numeric mt-1 text-4xl leading-none font-semibold">
                    {formatUsd(volume.total)}
                  </p>
                  {/* A variação é o número que a pessoa quer: quanto rodou desde
                      a medição anterior. O acumulado sozinho não diz isso. */}
                  {volume.variacao !== null ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      <span className="text-positive tabular font-medium">
                        +{formatUsd(volume.variacao)}
                      </span>{" "}
                      desde a medição anterior
                      {volume.totalAnterior !== null
                        ? `, que marcava ${formatUsd(volume.totalAnterior)}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-2 text-xs">
                      primeira medição: sem base de comparação
                    </p>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  medido em {formatDateBr(volume.atualizadoEm)}
                </p>
              </div>

              <h3 className="mb-3 text-sm font-medium">Por conta</h3>
              <div className="border-border mb-8 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-160 text-sm">
                  <caption className="sr-only">
                    Volume acumulado por conta neste projeto
                  </caption>
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs">
                      <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Acumulado</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Desde a anterior</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Medido em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {volume.contas.map((conta) => (
                      <tr key={conta.contaId} className="hover:bg-accent/40 transition-colors">
                        <th scope="row" className="px-4 py-3 text-left font-medium">
                          {conta.label}
                        </th>
                        <td className="tabular px-4 py-3 text-right">
                          {conta.total === null ? (
                            <span className="text-muted-foreground">sem medição</span>
                          ) : (
                            formatUsd(conta.total)
                          )}
                        </td>
                        <td className="tabular px-4 py-3 text-right">
                          {conta.variacao === null ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="text-positive">
                              +{formatUsd(conta.variacao)}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                          {conta.atualizadoEm ? formatDateBr(conta.atualizadoEm) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mb-3 text-sm font-medium">Medições</h3>
              <div className="border-border overflow-x-auto rounded-lg border">
                <table className="w-full min-w-160 text-sm">
                  <caption className="sr-only">Histórico de medições de volume</caption>
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs">
                      <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Acumulado</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">No período</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Nota</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {volume.historico.map((medicao) => (
                      <tr key={medicao.id}>
                        <th scope="row" className="tabular px-4 py-3 text-left font-normal">
                          {formatDateBr(medicao.data)}
                        </th>
                        <td className="px-4 py-3">{medicao.contaLabel}</td>
                        <td className="tabular px-4 py-3 text-right">
                          {formatUsd(medicao.total)}
                        </td>
                        <td className="tabular px-4 py-3 text-right">
                          {medicao.variacao === null ? (
                            <span className="text-muted-foreground">primeira</span>
                          ) : (
                            <span className="text-positive">
                              +{formatUsd(medicao.variacao)}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs">
                          {medicao.nota}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end">
                            <ConfirmarExclusao
                              titulo="Excluir medição"
                              alvo={`${formatUsd(medicao.total)} em ${formatDateBr(medicao.data)}`}
                              aoConfirmar={() => acoes.excluirVolume(medicao.id)}
                              gatilho={<BotaoLixeira rotulo="Excluir medição de volume" />}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="airdrop" className="mt-6">
          <div className="mb-4">
            <RegistrarRecebimento projectId={projeto.id} />
          </div>

          {projeto.recebimentos.length === 0 ? (
            /*
             * O texto muda conforme o status do próprio projeto.
             *
             * "O airdrop ainda não caiu" contradizia um projeto marcado como
             * Distribuído, e a contradição estava na tela sem ninguém notar: as
             * duas informações são declarações da mesma pessoa, e discordavam.
             *
             * A versão para o projeto distribuído diz o que se ganha ao
             * registrar, e não que algo está errado: quem lançou o valor como
             * resultado de trade tem o resultado certo, e o que falta é o
             * histórico de token, quantidade e preço.
             */
            faltaRegistrarRecebimento({
              status: projeto.status,
              recebimentos: projeto.recebimentos.length,
            }) ? (
              <EmptyState
                title="Este projeto está como distribuído, e não há recebimento aqui"
                description="Se o airdrop já caiu, registre quanto cada conta recebeu: fica o histórico de token, quantidade e preço, e o valor entra no ROI real do projeto. Se você lançou o valor como resultado de trade, o resultado já está certo, o que falta é este registro."
              />
            ) : (
              <EmptyState
                title="O airdrop ainda não caiu"
                description="Quando o token for distribuído, registre aqui quanto cada conta recebeu e a que preço. É o que fecha o cálculo de ROI real do projeto."
              />
            )
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
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
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
                        {/* Traço, e não zero: o valor foi lançado direto em
                            dólar, então a quantidade não é desconhecida por
                            engano, ela simplesmente não faz parte do registro. */}
                        {claim.quantidade ?? (
                          <span className="text-muted-foreground" title="Lançado direto em dólar">
                            &ndash;
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Money value={claim.valor} tone="auto" />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end">
                          <ConfirmarExclusao
                            titulo="Excluir recebimento"
                            alvo={
                              claim.quantidade
                                ? `${claim.quantidade} ${claim.token} de ${claim.contaLabel}`
                                : `${claim.token} de ${claim.contaLabel}`
                            }
                            aoConfirmar={() => acoes.excluirRecebimento(claim.id)}
                            gatilho={<BotaoLixeira rotulo="Excluir recebimento" />}
                          />
                        </div>
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
                  <dd>{projeto.chain ?? "-"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><ProjectStatusBadge status={projeto.status} /></dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Categoria</dt>
                  <dd className="text-right">
                    <CategoryBadge category={projeto.categoria} />
                    {projeto.categoria ? (
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {categoryDescriptions[projeto.categoria]}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Prioridade</dt>
                  <dd><PriorityMeter value={projeto.prioridade} /></dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">TGE previsto</dt>
                  <dd className="tabular">
                    {projeto.tgePrevisto ? formatDateBr(projeto.tgePrevisto) : "-"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Última atividade</dt>
                  <dd className="tabular">
                    {projeto.ultimaAtividade
                      ? formatDateBr(projeto.ultimaAtividade)
                      : "-"}
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
                          className="border-border hover:border-brand/50 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
