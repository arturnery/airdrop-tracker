"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Search } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { SugestoesDoCatalogo } from "@/components/catalogo-sugestoes";
import { AvisoSaldo } from "@/components/aviso-saldo";
import { FiltroChips } from "@/components/filtro-chips";
import {
  BotaoLixeira,
  ConfirmarExclusao,
} from "@/components/forms/confirmar-exclusao";
import { NovoProjeto } from "@/components/forms/dialogs";
import { EditarProjeto } from "@/components/forms/editar";
import { EmptyState, PageHeader } from "@/components/page-header";
import {
  CategoryBadge,
  categoryDescriptions,
  nomeRiscado,
  PriorityBadge,
  priorityLabels,
  ProjectStatusBadge,
} from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateShort, relativeLabel } from "@/lib/dates";
import { normalizar } from "@/lib/dataset";
import { cn } from "@/lib/utils";
import {
  contarDependenciasProjeto,
  descreverImpacto,
  selectProjects,
} from "@/lib/selectors";
import type { ProjectCategory, ProjectStatus, ProjectSummary } from "@/lib/types";

/**
 * Rótulos de status para o filtro. Só o texto: quem decide título de seção
 * agora é `ordemCategoria`, este serve só para nomear os chips.
 */
const statusFiltro: { valor: ProjectStatus; rotulo: string }[] = [
  { valor: "ativo", rotulo: "Ativos" },
  { valor: "tge_anunciado", rotulo: "TGE anunciado" },
  { valor: "pesquisando", rotulo: "Pesquisando" },
  { valor: "pausado", rotulo: "Pausados" },
  { valor: "distribuido", rotulo: "Distribuídos" },
  { valor: "descartado", rotulo: "Descartados" },
];

const categorias: { valor: ProjectCategory; rotulo: string }[] = [
  { valor: "liquidez", rotulo: "Liquidez" },
  { valor: "interacoes", rotulo: "Interações" },
  { valor: "perps", rotulo: "Perps" },
];

/**
 * Ordem das seções da grade: categoria, não status.
 *
 * A nota de cada seção reaproveita `categoryDescriptions`, a mesma frase que
 * já explica a categoria no selo do card e no formulário: descrição
 * divergente entre os dois lugares seria pior do que nenhuma.
 *
 * `null` sempre por último: um projeto sem categoria não é uma categoria
 * própria, é a ausência de uma, e a seção existe só para ele não sumir da
 * tela — sem ela, "sem categoria" simplesmente não apareceria em lugar
 * nenhum, e pareceria que o projeto foi perdido.
 */
const ordemCategoria: { chave: ProjectCategory | null; titulo: string; nota?: string }[] =
  [
    { chave: "liquidez", titulo: "Liquidez", nota: categoryDescriptions.liquidez },
    { chave: "interacoes", titulo: "Interações", nota: categoryDescriptions.interacoes },
    { chave: "perps", titulo: "Perps", nota: categoryDescriptions.perps },
    { chave: null, titulo: "Sem categoria" },
  ];

/**
 * Card de projeto: identidade, os três filtros como selo, e o que precisa de
 * ação.
 *
 * Deliberadamente sem números financeiros. Resultado, exposição e capital
 * saíram daqui: a lista virou um painel de "o que farmar hoje e em que
 * estado cada coisa está", e quem quer o valor em dólar abre o projeto — a
 * aba dele continua com o painel de indicadores inteiro. Cabe registrar o
 * custo aceito: comparar resultado entre projetos não dá mais para fazer só
 * de olho na lista.
 */
function CardProjeto({ projeto }: { projeto: ProjectSummary }) {
  const { dataset, hoje, acoes } = useDados();

  return (
    /*
     * Card inteiro clicável via "stretched link": o <Link> continua sendo um
     * único link real (bom para teclado e leitor de tela), mas seu ::after
     * cobre o card todo. Envolver o card no <Link> aninharia os links internos.
     */
    /*
     * O realce de foco usa `--ring` em opacidade cheia, e o de mouse usa a
     * marca a 40%. A diferença não é estética: indicador de foco tem exigência
     * de contraste (3:1) e o realce de mouse não, porque ali o ponteiro já diz
     * onde se está. `brand/60` dava 2,33:1 sobre o card e reprovava; o anel dá
     * 6,33:1. Medido no CSS compilado, que é o que o navegador recebe.
     */
    <article className="group bg-card border-border hover:border-brand/40 focus-within:border-ring relative flex h-full flex-col rounded-lg border p-6 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/*
            Inicial em vez de logo: o sistema não guarda imagem de projeto, e
            uma letra já basta para o olho reencontrar a mesma linha ao rolar
            uma lista de dezenas. Tinta da marca, não cor sorteada por projeto:
            cor aqui seria decoração, e verde e vermelho estão reservados a
            ganho e perda (§14.8).
          */}
          <span
            aria-hidden="true"
            className="bg-brand/15 text-brand-legivel flex size-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
          >
            {projeto.nome.trim().charAt(0).toUpperCase()}
          </span>
          <h3 className="min-w-0 text-lg font-semibold tracking-tight">
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
        </div>
        {/*
          z-10 tira os botões de baixo do stretched link do card, senão o
          clique abriria o projeto em vez de editar.

          A moldura é aplicada aqui, e não dentro dos botões, porque eles são
          compartilhados com tabelas e listas onde a borda viraria ruído. Neste
          card ela equilibra o avatar do outro lado e faz os dois ícones
          parecerem alvos de clique, e não decoração do canto.
        */}
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 [&_button]:border [&_button]:border-border/70">
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

      {/*
        Os três filtros da tela, no card, como selo: categoria, status e
        prioridade. A categoria repete a da seção de propósito — nem todo
        card vai ficar perto do título da seção depois de rolar a página, e
        aqui o selo é barato, cabe numa linha com os outros dois.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={projeto.categoria} />
        <ProjectStatusBadge status={projeto.status} />
        <PriorityBadge value={projeto.prioridade} />
      </div>

      {projeto.alerta ? (
        <AvisoSaldo alerta={projeto.alerta} className="mt-4" />
      ) : null}

      {/*
        `mt-auto` empurra o rodapé para a base. Sem isso, num card mais curto
        que o vizinho da mesma fileira, o rodapé ficava boiando no meio, com
        espaço vazio embaixo: a grade iguala a altura dos cards, e só o
        conteúdo é que não enchia.

        Duas metades sempre presentes (mesmo vazias), e não um `justify-between`
        com um filho só: um card sem atrasada e sem data não deveria ver a
        data pular para a esquerda por falta de par do outro lado.
      */}
      <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs">
        <div>
          {projeto.tarefasAtrasadas > 0 ? (
            <span className="bg-negative/15 text-negative inline-flex items-center rounded-full px-2.5 py-0.5 font-medium">
              {projeto.tarefasAtrasadas} atrasada
              {projeto.tarefasAtrasadas > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <div>
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
  );
}

export function ProjetosView() {
  const { dataset, hoje } = useDados();
  const [categoria, setCategoria] = useState<ProjectCategory | null>(null);
  const [prioridade, setPrioridade] = useState<string | null>(null);
  /*
   * Começa em "ativo", não em "todos". A tela principal é para "o que estou
   * farmando agora": pausado e distribuído só entram quando a pessoa pede,
   * clicando no chip ou em "Todos". Categoria e prioridade filtram dentro
   * disso, e não do total, pelo mesmo motivo.
   */
  const [status, setStatus] = useState<ProjectStatus | null>("ativo");
  const [busca, setBusca] = useState("");

  const todos = selectProjects(dataset, hoje);

  /*
   * Busca sem acento e sem caixa: "solstice" acha "Solstïce", e "unit" acha
   * "Unit". Digitar o acento certo para achar o que se está olhando na tela é
   * exatamente o atrito que uma busca deveria remover.
   */
  const termo = normalizar(busca);

  const filtrados = todos.filter(
    (p) =>
      (categoria === null || p.categoria === categoria) &&
      (prioridade === null || String(p.prioridade) === prioridade) &&
      (status === null || p.status === status) &&
      (termo === "" || normalizar(p.nome).includes(termo)),
  );

  // Contagens vêm do conjunto completo: um filtro que zera a própria contagem
  // esconderia a saída para desfazê-lo.
  const contarCategoria = (valor: ProjectCategory) =>
    todos.filter((p) => p.categoria === valor).length;
  const contarPrioridade = (valor: number) =>
    todos.filter((p) => p.prioridade === valor).length;
  const contarStatus = (valor: ProjectStatus) =>
    todos.filter((p) => p.status === valor).length;

  const grupos = ordemCategoria
    .map((secao) => ({
      ...secao,
      projetos: filtrados
        .filter((p) => p.categoria === secao.chave)
        // Dentro da categoria, prioridade manda; empate desempata por capital.
        .sort((a, b) => b.prioridade - a.prioridade || b.aportado - a.aportado),
    }))
    .filter((grupo) => grupo.projetos.length > 0);

  const temFiltro =
    categoria !== null || prioridade !== null || status !== null || termo !== "";

  return (
    <>
      <PageHeader
        icon={Layers}
        title="Projetos"
        description="Agrupados por categoria; dentro de cada grupo, os de maior prioridade primeiro."
        actions={<NovoProjeto />}
      />

      <SugestoesDoCatalogo />

      {todos.length > 0 ? (
        <div className="border-border mb-8 flex flex-col gap-3 rounded-lg border p-4">
          {/*
            A busca vem antes dos chips porque é o caminho mais curto quando se
            sabe o nome: os filtros servem para explorar, e a busca para ir
            direto. Filtra ao digitar, sem botão de confirmar, porque com o
            resultado mudando a cada letra o botão só adicionaria um passo.
          */}
          <div className="flex items-center gap-2">
            <label htmlFor="busca-projeto" className="text-muted-foreground text-xs">
              Buscar
            </label>
            <div className="relative max-w-xs flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="busca-projeto"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Nome do projeto"
                className="h-8 pl-8 text-sm"
                autoComplete="off"
              />
            </div>
            {busca ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setBusca("")}
              >
                Limpar
              </Button>
            ) : null}
          </div>

          {/*
            Categoria primeiro da lista porque é o eixo em que a tela já se
            organiza: os grupos são as categorias. Filtrar por uma delas não
            muda a estrutura, reduz a página a uma seção só.
          */}
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
            legenda="Status"
            selecionado={status}
            aoSelecionar={setStatus}
            opcoes={[
              { valor: null, rotulo: "Todos", contagem: todos.length },
              ...statusFiltro
                .map((s) => ({
                  valor: s.valor,
                  rotulo: s.rotulo,
                  contagem: contarStatus(s.valor),
                }))
                // Status sem projeto nenhum não vira chip: a lista tem seis, e
                // oferecer os vazios enche a barra de opção que não leva a nada.
                .filter((s) => s.contagem > 0),
            ]}
          />
          <FiltroChips
            legenda="Prioridade"
            selecionado={prioridade}
            aoSelecionar={setPrioridade}
            opcoes={[
              { valor: null, rotulo: "Todas" },
              ...[3, 2, 1]
                .map((n) => ({
                  valor: String(n),
                  rotulo: priorityLabels[n],
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
                  setStatus(null);
                  setBusca("");
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
          description="Adicione um dos farms atuais acima, ou cadastre o que você está farmando para começar a acompanhar capital e tarefas."
        />
      ) : grupos.length === 0 ? (
        /*
         * O vazio diz o que foi procurado, e não só que não achou. Quem digitou
         * um nome quase certo precisa ver o que digitou para perceber o engano,
         * e o botão devolve a lista inteira sem obrigar a apagar campo a campo.
         */
        <EmptyState
          title={
            termo
              ? `Nenhum projeto com "${busca.trim()}"`
              : "Nenhum projeto com esses filtros"
          }
          description={
            termo
              ? "Confira a escrita, ou limpe os filtros para ver todos de novo."
              : "Ajuste o status, a categoria ou a prioridade para ver outros projetos."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCategoria(null);
                setPrioridade(null);
                setStatus(null);
                setBusca("");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {grupos.map((grupo) => (
            <section
              key={grupo.chave ?? "sem-categoria"}
              aria-labelledby={`grupo-${grupo.chave ?? "sem-categoria"}`}
            >
              <div className="mb-4 flex items-baseline gap-3">
                <h2
                  id={`grupo-${grupo.chave ?? "sem-categoria"}`}
                  className="flex items-center gap-2 text-base font-medium"
                >
                  <CategoryBadge category={grupo.chave} />
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
