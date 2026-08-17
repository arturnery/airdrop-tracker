"use client";

import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { CapitalPorProjetoChart } from "@/components/capital-chart";
import { ListaAtividade } from "@/components/historico";
import { CardPrograma } from "@/components/pontos";
import { useDados } from "@/components/data-provider";
import { NovoLancamento, RegistrarPontos } from "@/components/forms/dialogs";
import { Money, Percent } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ResumoDeAvisos } from "@/components/aviso-saldo";
import { StatCard } from "@/components/stat-card";
import { UrgencyBadge } from "@/components/status-badge";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import {
  selectAtividade,
  selectCapitalPorProjeto,
  selectDashboardSummary,
  selectPendingTasks,
  selectProgramasDePontos,
  selectProjects,
} from "@/lib/selectors";

export function DashboardView() {
  const { dataset, hoje } = useDados();

  const resumo = selectDashboardSummary(dataset, hoje);
  const capital = selectCapitalPorProjeto(dataset);
  const projetos = selectProjects(dataset, hoje);
  const tarefas = selectPendingTasks(dataset, hoje);
  const atividade = selectAtividade(dataset, 10);
  const programas = selectProgramasDePontos(dataset);

  const urgentes = tarefas.filter(
    (t) => t.urgencia === "atrasada" || t.urgencia === "hoje",
  );
  const semCotacao = resumo.tokensSemCotacao;

  return (
    <>
      <PageHeader
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

      {/* Ordem: quanto entrou, onde está, o que sobrou, o que fazer. */}
      <section
        aria-label="Indicadores"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Capital depositado"
          accent="primary"
          value={<Money value={resumo.capitalDepositado} />}
          hint={`${resumo.projetosAtivos} projetos ativos · ${resumo.contasAtivas} contas`}
        />
        <StatCard
          label="Exposição atual"
          accent="idle"
          value={<Money value={resumo.exposicao} />}
          hint={
            semCotacao.length > 0
              ? `${semCotacao.join(", ")} sem cotação`
              : "soma de todos os lançamentos"
          }
        />
        <StatCard
          label="Resultado"
          accent={resumo.resultado >= 0 ? "positive" : "negative"}
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

      {semCotacao.length > 0 ? (
        <p className="border-caution/30 bg-caution/5 text-muted-foreground mt-4 flex items-start gap-2 rounded-md border px-4 py-3 text-sm">
          <TriangleAlert
            className="text-caution mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            <strong className="text-foreground font-medium">
              {semCotacao.join(", ")} sem cotação informada.
            </strong>{" "}
            A posição nesses tokens está avaliada pelo valor do aporte, sem ganho nem
            perda de preço.{" "}
            <Link href="/cotacoes" className="text-foreground underline underline-offset-4">
              Informar agora
            </Link>
            .
          </span>
        </p>
      ) : null}

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

      {/* ------------------------------------------------------------- pontos */}
      {programas.length > 0 ? (
        <section aria-labelledby="titulo-pontos" className="mt-10">
          <h2 id="titulo-pontos" className="text-lg font-medium">
            Programas de pontos
          </h2>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            Cada programa tem unidade própria e por isso não existe total geral:
            o que se compara entre projetos é o ganho, não o acumulado.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {programas.map((programa) => (
              <CardPrograma
                key={programa.projetoId}
                programa={programa}
                hoje={hoje}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- histórico */}
      <section aria-labelledby="titulo-historico" className="mt-10">
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <h2 id="titulo-historico" className="text-lg font-medium">
            Histórico
          </h2>
          <Link
            href="/historico"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            Ver tudo
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <p className="text-muted-foreground mb-4 text-sm">
          Tudo que foi feito, do mais recente para o mais antigo.
        </p>

        {atividade.length === 0 ? (
          <EmptyState
            title="Nada registrado ainda"
            description="Depósitos, saldos, tarefas concluídas e airdrops recebidos aparecem aqui conforme você registra."
          />
        ) : (
          <ListaAtividade itens={atividade} hoje={hoje} />
        )}
      </section>
    </>
  );
}
