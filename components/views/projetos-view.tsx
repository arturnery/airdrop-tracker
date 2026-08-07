"use client";

import { useState } from "react";
import Link from "next/link";

import { useDados } from "@/components/data-provider";
import { FiltroChips } from "@/components/filtro-chips";
import {
  BotaoLixeira,
  ConfirmarExclusao,
} from "@/components/forms/confirmar-exclusao";
import { NovoProjeto } from "@/components/forms/dialogs";
import { EditarProjeto } from "@/components/forms/editar";
import { Money, Percent } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/page-header";
import {
  CategoryBadge,
  nomeRiscado,
  PriorityMeter,
  ProjectStatusBadge,
} from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateShort, relativeLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  contarDependenciasProjeto,
  descreverImpacto,
  selectProjects,
} from "@/lib/selectors";
import type { ProjectCategory, ProjectStatus, ProjectSummary } from "@/lib/types";

/** Ordem de exibição dos status: o que exige ação primeiro, arquivo por último. */
const ordemStatus: { chave: ProjectStatus; titulo: string; nota?: string }[] = [
  { chave: "ativo", titulo: "Ativos", nota: "farmando agora" },
  { chave: "tge_anunciado", titulo: "TGE anunciado", nota: "token a caminho" },
  { chave: "pesquisando", titulo: "Pesquisando", nota: "avaliando se vale" },
  { chave: "pausado", titulo: "Pausados" },
  { chave: "distribuido", titulo: "Distribuídos", nota: "airdrop já recebido" },
  { chave: "descartado", titulo: "Descartados" },
];

const categorias: { valor: ProjectCategory; rotulo: string }[] = [
  { valor: "liquidez", rotulo: "Liquidez" },
  { valor: "interacoes", rotulo: "Interações" },
  { valor: "perps", rotulo: "Perps" },
];

function CardProjeto({ projeto }: { projeto: ProjectSummary }) {
  const { dataset, hoje, acoes } = useDados();

  return (
    /*
     * Card inteiro clicável via "stretched link": o <Link> continua sendo um
     * único link real (bom para teclado e leitor de tela), mas seu ::after
     * cobre o card todo. Envolver o card no <Link> aninharia os links internos.
     */
    <article className="group bg-card border-border hover:border-primary/40 focus-within:border-primary/60 relative rounded-lg border p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium">
            <Link
              href={`/projetos/${projeto.slug}`}
              className={cn(
                "after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none",
                nomeRiscado(projeto.status),
              )}
            >
              {projeto.nome}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {projeto.chain ?? "rede não informada"}
            {" · "}
            {projeto.contas} {projeto.contas === 1 ? "conta" : "contas"}
          </p>
        </div>
        {/* z-10 tira os botões de baixo do stretched link do card, senão o
            clique abriria o projeto em vez de editar. */}
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <EditarProjeto projectId={projeto.id} />
          <ConfirmarExclusao
            titulo="Excluir projeto"
            alvo={projeto.nome}
            impacto={descreverImpacto(contarDependenciasProjeto(dataset, projeto.id))}
            aoConfirmar={() => acoes.excluirProjeto(projeto.id)}
            gatilho={<BotaoLixeira rotulo={`Excluir ${projeto.nome}`} />}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={projeto.categoria} />
        <PriorityMeter value={projeto.prioridade} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
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

      <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs">
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
    </article>
  );
}

export function ProjetosView() {
  const { dataset, hoje } = useDados();
  const [categoria, setCategoria] = useState<ProjectCategory | null>(null);
  const [prioridade, setPrioridade] = useState<string | null>(null);

  const todos = selectProjects(dataset, hoje);

  const filtrados = todos.filter(
    (p) =>
      (categoria === null || p.categoria === categoria) &&
      (prioridade === null || String(p.prioridade) === prioridade),
  );

  // Contagens vêm do conjunto completo: um filtro que zera a própria contagem
  // esconderia a saída para desfazê-lo.
  const contarCategoria = (valor: ProjectCategory) =>
    todos.filter((p) => p.categoria === valor).length;
  const contarPrioridade = (valor: number) =>
    todos.filter((p) => p.prioridade === valor).length;

  const grupos = ordemStatus
    .map((secao) => ({
      ...secao,
      projetos: filtrados
        .filter((p) => p.status === secao.chave)
        // Dentro do status, prioridade manda; empate desempata por capital.
        .sort((a, b) => b.prioridade - a.prioridade || b.aportado - a.aportado),
    }))
    .filter((grupo) => grupo.projetos.length > 0);

  const temFiltro = categoria !== null || prioridade !== null;

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Agrupados por status; dentro de cada grupo, os de maior prioridade primeiro."
        actions={<NovoProjeto />}
      />

      {todos.length > 0 ? (
        <div className="border-border mb-8 flex flex-col gap-3 rounded-lg border p-4">
          <FiltroChips
            legenda="Categoria"
            selecionado={categoria}
            aoSelecionar={setCategoria}
            opcoes={[
              { valor: null, rotulo: "Todas", contagem: todos.length },
              ...categorias.map((c) => ({
                valor: c.valor,
                rotulo: c.rotulo,
                contagem: contarCategoria(c.valor),
              })),
            ]}
          />
          <FiltroChips
            legenda="Prioridade"
            selecionado={prioridade}
            aoSelecionar={setPrioridade}
            opcoes={[
              { valor: null, rotulo: "Todas" },
              ...[5, 4, 3, 2, 1]
                .map((n) => ({
                  valor: String(n),
                  rotulo: String(n),
                  contagem: contarPrioridade(n),
                }))
                // Não oferece filtro que não devolveria nada. As categorias
                // continuam todas visíveis por serem um conjunto fixo e curto.
                .filter((p) => p.contagem > 0),
            ]}
          />
          {temFiltro ? (
            <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-muted-foreground text-xs">
                {filtrados.length} de {todos.length}{" "}
                {todos.length === 1 ? "projeto" : "projetos"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setCategoria(null);
                  setPrioridade(null);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {todos.length === 0 ? (
        <EmptyState
          title="Nenhum projeto cadastrado"
          description="Cadastre o primeiro airdrop que você está farmando para começar a acompanhar capital e tarefas."
        />
      ) : grupos.length === 0 ? (
        <EmptyState
          title="Nenhum projeto com esses filtros"
          description="Ajuste a categoria ou a prioridade para ver outros projetos."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCategoria(null);
                setPrioridade(null);
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {grupos.map((grupo) => (
            <section key={grupo.chave} aria-labelledby={`grupo-${grupo.chave}`}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2
                  id={`grupo-${grupo.chave}`}
                  className="flex items-center gap-2 text-base font-medium"
                >
                  <ProjectStatusBadge status={grupo.chave} />
                  <span className="text-muted-foreground tabular text-sm">
                    {grupo.projetos.length}
                  </span>
                </h2>
                {grupo.nota ? (
                  <span className="text-muted-foreground text-xs">{grupo.nota}</span>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {grupo.projetos.map((projeto) => (
                  <CardProjeto key={projeto.id} projeto={projeto} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
