"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";

import { CapitalPorProjetoChart } from "@/components/capital-chart";
import { useDados } from "@/components/data-provider";
import { NovoLancamento, RegistrarPontos } from "@/components/forms/dialogs";
import { Money, Percent } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ResultadoChart } from "@/components/resultado-chart";
import { ResumoDeAvisos } from "@/components/aviso-saldo";
import { explicacoes } from "@/components/ajuda";
import { StatCard } from "@/components/stat-card";
import { UrgencyBadge } from "@/components/status-badge";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import {
  selectCapitalPorProjeto,
  selectDashboardSummary,
  selectEvolucaoDoResultado,
  selectPendingTasks,
  selectProjects,
} from "@/lib/selectors";

export function DashboardView() {
  const { dataset, hoje } = useDados();

  const resumo = selectDashboardSummary(dataset, hoje);
  const capital = selectCapitalPorProjeto(dataset);
  const evolucao = selectEvolucaoDoResultado(dataset);
  const projetos = selectProjects(dataset, hoje);
  const tarefas = selectPendingTasks(dataset, hoje);

  const urgentes = tarefas.filter(
    (t) => t.urgencia === "atrasada" || t.urgencia === "hoje",
  );

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Visão geral"
        description={`Posição consolidada em ${formatDateBr(hoje)}.`}
        actions={
          <>
            <RegistrarPontos />
            <NovoLancamento />
          </>
        }
      />

      {/*
        Antes dos indicadores: um total que embute saldo impossível engana mais
        do que informa, e quem olha o número grande primeiro precisa saber disso
        antes de tirar conclusão dele.
      */}
      <ResumoDeAvisos projetos={projetos} />

      {/*
        Ordem: o que já rendeu, onde está o capital agora, o que sobrou.
        Capital depositado e tarefas pendentes saíram daqui: o primeiro só
        interessa de olho no ROI, e esse cálculo já mora na aba de cada
        projeto; o segundo já tem número próprio no badge da barra lateral, e
        repetir o mesmo total aqui não acrescentava, só duplicava.
      */}
      <section
        aria-label="Indicadores"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatCard
          label="Airdrops ganhos"
          accent="positive"
          ajuda={explicacoes.airdropsGanhos}
          value={<span className="tabular">{resumo.airdropsGanhos}</span>}
          hint={
            resumo.airdropsGanhos > 0 ? (
              <>
                <Money value={resumo.airdrops} /> recebidos ao todo
              </>
            ) : (
              "nenhum registrado ainda"
            )
          }
        />
        <StatCard
          label="Exposição atual"
          accent="idle"
          ajuda={explicacoes.exposicao}
          value={<Money value={resumo.exposicao} />}
          hint="soma de todos os lançamentos"
        />
        <StatCard
          label="Resultado"
          accent={resumo.resultado >= 0 ? "positive" : "negative"}
          ajuda={explicacoes.resultado}
          value={<Money value={resumo.resultado} tone="auto" signed />}
          hint={
            resumo.roi === null ? (
              "sem capital depositado"
            ) : (
              <span className="inline-flex items-center gap-1.5">
                ROI <Percent value={resumo.roi} />
              </span>
            )
          }
        />
      </section>

      <section aria-labelledby="titulo-evolucao" className="mt-10">
        <h2 id="titulo-evolucao" className="mb-1 text-lg font-medium">
          Resultado ao longo do tempo
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Cada ponto maior é um airdrop recebido: passe o mouse para ver qual.
        </p>
        <ResultadoChart pontos={evolucao} />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
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
            <EmptyState
              title="Nada pendente para hoje."
              description="As próximas tarefas aparecem aqui conforme vencem."
            />
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
                      {relativeLabel(tarefa.vencimento, hoje)}
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

        <section aria-labelledby="titulo-capital">
          <h2 id="titulo-capital" className="mb-4 text-lg font-medium">
            Onde está o capital
          </h2>
          <CapitalPorProjetoChart data={capital} />
        </section>
      </div>

      {/*
        A lista de projetos saiu daqui.
        
        Ela repetia, em tabela, o que a aba Projetos mostra melhor: lá os cards
        têm busca, filtro por status, categoria e prioridade, e o agrupamento
        que a visão geral não tinha como reproduzir. Duas apresentações do mesmo
        dado obrigam a manter as duas em dia, e a pior envelhece primeiro.

        O convite para o primeiro projeto ficou, porque era a única porta de
        entrada para quem chega com a conta vazia: sem ele, o painel novo seria
        uma sequência de estados vazios sem dizer o que fazer.
      */}
      {projetos.length === 0 ? (
        <section aria-label="Primeiro projeto" className="mt-10">
          <EmptyState
            title="Nenhum projeto cadastrado"
            description="Cadastre o primeiro airdrop que você está farmando para começar a acompanhar capital e tarefas."
            action={
              <Link
                href="/projetos"
                className="border-border hover:border-brand/50 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Ir para Projetos
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
        </section>
      ) : null}
    </>
  );
}
