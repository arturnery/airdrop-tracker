"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, Search } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { AvisoSaldo } from "@/components/aviso-saldo";
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

/**
 * Resultado do projeto, promovido a bloco próprio.
 *
 * Antes ele era a terceira coluna de uma linha de três, com o mesmo peso de
 * "depositado" e "exposição". Os três respondem perguntas diferentes: os dois
 * primeiros dizem quanto entrou e quanto está lá, e o terceiro diz **se valeu a
 * pena**. Ter um bloco próprio resolve isso.
 *
 * O que ele **não** é: o maior destaque do card. Numa lista, a primeira
 * pergunta é "qual projeto é este", e a resposta é o nome. Uma primeira versão
 * pôs o resultado em corpo 24 e ele passou a ser lido antes do nome, o que
 * inverte a ordem em que a informação é procurada. O número recuou para o corpo
 * do texto, e a saliência dele agora vem da serif, da cor e da moldura, que
 * bastam para achá-lo sem disputar a leitura.
 *
 * O sinal aparece de três formas ao mesmo tempo: cor, seta e o próprio número
 * com sinal. Cor sozinha não serve como indicador, e a seta some para quem não
 * distingue verde de vermelho.
 *
 * Verde e vermelho aqui são significado, não estilo: é exatamente o uso que
 * §14.8 reserva a eles. O azul da marca fica no avatar e no realce de foco.
 */
function PainelResultado({ projeto }: { projeto: ProjectSummary }) {
  const positivo = projeto.resultado > 0;
  const negativo = projeto.resultado < 0;

  /*
   * Projeto sem dinheiro nenhum não mostra "$0,00" num painel de destaque:
   * o zero ali sugere apuração feita e resultado nulo, quando o que houve foi
   * ausência de movimento. A moldura continua, para os cards não ficarem de
   * alturas diferentes na mesma fileira.
   */
  const semMovimento =
    projeto.aportado === 0 && projeto.exposicao === 0 && projeto.resultado === 0;

  const Seta = positivo ? ArrowUpRight : negativo ? ArrowDownRight : Minus;

  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5",
        positivo && "border-positive/30 bg-positive/10",
        negativo && "border-negative/30 bg-negative/10",
        !positivo && !negativo && "border-border bg-secondary/40",
      )}
    >
      <div className="min-w-0">
        <p className="text-muted-foreground text-[0.6875rem] font-medium tracking-wider uppercase">
          Resultado
        </p>
        {semMovimento ? (
          <p className="text-muted-foreground mt-1 text-sm">sem movimento</p>
        ) : (
          <p className="mt-1 flex items-baseline gap-2">
            {/* Serif e tamanho grande, como nos cartões de indicador: número é
                o que o olho procura primeiro, e a troca de família o destaca
                sem precisar de mais cor. */}
            <Money
              value={projeto.resultado}
              tone="auto"
              signed
              className="font-numeric text-base leading-none font-semibold"
            />
            <Percent value={projeto.roi} className="text-xs" />
          </p>
        )}
      </div>

      {semMovimento ? null : (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md border",
            positivo && "border-positive/30 text-positive",
            negativo && "border-negative/30 text-negative",
            !positivo && !negativo && "border-border text-muted-foreground",
          )}
        >
          <Seta className="size-3.5" />
        </span>
      )}
    </div>
  );
}

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
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight">
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
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {projeto.chain ?? "rede não informada"}
              {" · "}
              {projeto.contas} {projeto.contas === 1 ? "conta" : "contas"}
            </p>
          </div>
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={projeto.categoria} />
        <PriorityMeter value={projeto.prioridade} />
      </div>

      {projeto.alerta ? (
        <AvisoSaldo alerta={projeto.alerta} className="mt-4" />
      ) : null}

      <PainelResultado projeto={projeto} />

      <dl className="mt-4 mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">Depositado</dt>
          <dd className="mt-0.5">
            <Money value={projeto.capitalDepositado} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Exposição</dt>
          <dd className="mt-0.5">
            <Money value={projeto.exposicao} tone="muted" />
          </dd>
        </div>

        {/*
          Aparece sempre que houver volume, e não só em perps.
          A regra por categoria escondia o número em projetos de interações que
          também operam volume, como mercados de previsão: quem lançava ali não
          via o valor em lugar nenhum. O critério passou a ser ter volume, que
          é o que de fato indica se a informação interessa àquele projeto.
        */}
        {projeto.volumeOperado > 0 ? (
          <div className="col-span-2 border-t border-border pt-3">
            <dt className="text-muted-foreground text-xs">Volume operado</dt>
            <dd className="mt-0.5">
              <Money value={projeto.volumeOperado} tone="muted" />
            </dd>
          </div>
        ) : null}
      </dl>

      {/*
        `mt-auto` empurra o rodapé para a base. Sem isso, num card mais curto
        que o vizinho da mesma fileira, "sem pendências" e a data ficavam
        boiando no meio, com espaço vazio embaixo: a grade iguala a altura dos
        cards, e só o conteúdo é que não enchia.
      */}
      <div className="border-border mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs">
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
  const [status, setStatus] = useState<ProjectStatus | null>(null);
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

  const grupos = ordemStatus
    .map((secao) => ({
      ...secao,
      projetos: filtrados
        .filter((p) => p.status === secao.chave)
        // Dentro do status, prioridade manda; empate desempata por capital.
        .sort((a, b) => b.prioridade - a.prioridade || b.aportado - a.aportado),
    }))
    .filter((grupo) => grupo.projetos.length > 0);

  const temFiltro =
    categoria !== null || prioridade !== null || status !== null || termo !== "";

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Agrupados por status; dentro de cada grupo, os de maior prioridade primeiro."
        actions={<NovoProjeto />}
      />

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
            Primeiro da lista porque é o eixo em que a tela já se organiza: os
            grupos são os status. Filtrar por um deles não muda a estrutura,
            reduz a página a uma seção só, que é o que se quer quando a lista
            cresce e "Ativos" fica longe do topo.
          */}
          <FiltroChips
            legenda="Status"
            selecionado={status}
            aoSelecionar={setStatus}
            opcoes={[
              { valor: null, rotulo: "Todos", contagem: todos.length },
              ...ordemStatus
                .map((secao) => ({
                  valor: secao.chave,
                  rotulo: secao.titulo,
                  contagem: contarStatus(secao.chave),
                }))
                // Status sem projeto nenhum não vira chip: a lista tem seis, e
                // oferecer os vazios enche a barra de opção que não leva a nada.
                .filter((secao) => secao.contagem > 0),
            ]}
          />
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
          description="Cadastre o primeiro airdrop que você está farmando para começar a acompanhar capital e tarefas."
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
