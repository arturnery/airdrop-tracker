"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Search, Sprout } from "lucide-react";

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
import { Money, Percent } from "@/components/money";
import { AvisoMudancaDoDestaque, BotaoFarmar, TirarDoFarm } from "@/components/forms/farm";
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
import { podeFarmar } from "@/lib/farm";
import { cn } from "@/lib/utils";
import { LinksDoProjeto } from "@/components/links-do-projeto";
import { AvisoSemContaCompacto } from "@/components/aviso-sem-conta";
import {
  contarDependenciasProjeto,
  descreverImpacto,
  selectProjects,
} from "@/lib/selectors";
import type { ProjectCategory, ProjectStatus, ProjectSummary } from "@/lib/types";

/**
 * Seções de "Todos os projetos": por status, porque ali o que a pessoa
 * procura é o estado de cada projeto que ela não está farmando (em estudo,
 * pausado, já distribuído). Os ativos aparecem primeiro: são os únicos que
 * ainda podem entrar no farm.
 */
const ordemStatus: { chave: ProjectStatus; titulo: string; nota?: string }[] = [
  { chave: "ativo", titulo: "Ativos fora do farm", nota: "Podem entrar em Farmando agora." },
  { chave: "tge_anunciado", titulo: "TGE anunciado", nota: "Podem entrar em Farmando agora." },
  { chave: "pesquisando", titulo: "Em estudo" },
  { chave: "pausado", titulo: "Pausados" },
  { chave: "distribuido", titulo: "Distribuídos" },
  { chave: "descartado", titulo: "Descartados" },
];

const categorias: { valor: ProjectCategory; rotulo: string }[] = [
  { valor: "liquidez", rotulo: "Liquidez" },
  { valor: "interacoes", rotulo: "Interações" },
  { valor: "perps", rotulo: "Perps" },
];

/**
 * Ordem das seções de "Farmando agora": categoria, não status.
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
 * ação. Dois modos, um por aba:
 *
 * - **todos**: sem números financeiros, é a lista de estado de cada projeto.
 *   A exceção é o distribuído, cujo resultado já fechou. Ativo fora do farm
 *   ganha o botão Farmar; quem saiu do farm mostra o motivo.
 * - **farm**: os números voltam (depositado, exposição, resultado com ROI),
 *   porque é a carteira do que se está farmando e é ali que se compara um
 *   projeto com outro. O botão é o de tirar do farm.
 */
function CardProjeto({ projeto, modo }: { projeto: ProjectSummary; modo: "todos" | "farm" }) {
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
    <article className="group bg-card border-border hover:border-brand/40 focus-within:border-ring relative flex h-full flex-col rounded-lg border p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/*
            Inicial em vez de logo: o sistema não guarda imagem de projeto, e
            uma letra já basta para o olho reencontrar a mesma linha ao rolar
            uma lista de dezenas. Tinta da marca, não cor sorteada por projeto:
            cor aqui seria decoração, e verde e vermelho estão reservados a
            ganho e perda (§14.8).
          */}
          <span
            aria-hidden="true"
            className="bg-brand/15 text-brand-legivel flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold"
          >
            {projeto.nome.trim().charAt(0).toUpperCase()}
          </span>
          <h3 className="min-w-0 text-lg leading-tight font-semibold tracking-tight">
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
        Todo card tem a mesma estrutura, com as mesmas alturas: selos, uma
        faixa do meio de altura reservada e o rodapé preso à base. Antes, o que
        aparecia ou não (links, resultado) empurrava o rodapé, e a linha de
        separação ficava num lugar diferente em cada card da mesma fileira.

        A faixa do meio é reservada mesmo vazia. Único número financeiro que
        volta ao card, o resultado, só aparece quando o status é final:
        distribuído não tem exposição em aberto nem capital para comparar, só o
        resultado que já aconteceu. O aviso de saldo impossível é o único
        conteúdo que pode deixar um card mais alto: é raro, e importante demais
        para ser cortado.
      */}
      <div className="mt-3 flex min-h-10 flex-col justify-center gap-2">
        {projeto.mudancaDoDestaque ? (
          <AvisoMudancaDoDestaque projeto={projeto} novo={projeto.mudancaDoDestaque} />
        ) : null}
        {projeto.contas === 0 ? <AvisoSemContaCompacto /> : null}
        {projeto.alerta ? <AvisoSaldo alerta={projeto.alerta} /> : null}
        {modo === "farm" ? (
          <dl className="bg-secondary/40 grid grid-cols-3 gap-2 rounded-md px-3 py-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Depositado</dt>
              <dd className="mt-0.5 text-sm font-semibold">
                <Money value={projeto.capitalNoPico} compact />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Exposição</dt>
              <dd className="mt-0.5 text-sm font-semibold">
                <Money value={projeto.exposicao} compact />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Resultado</dt>
              <dd className="mt-0.5 text-sm font-semibold">
                <Money value={projeto.resultado} tone="auto" signed compact />
              </dd>
              {projeto.roi !== null ? (
                <dd className="text-muted-foreground mt-0.5">
                  ROI <Percent value={projeto.roi} />
                </dd>
              ) : null}
            </div>
          </dl>
        ) : null}
        {modo === "todos" && projeto.saidaDoFarmMotivo ? (
          <p className="text-muted-foreground text-xs">
            Saiu do farm: {projeto.saidaDoFarmMotivo}
          </p>
        ) : null}
        {modo === "todos" && projeto.status === "distribuido" ? (
          <div className="bg-secondary/40 flex h-10 items-center justify-between rounded-md px-3">
            <span className="text-muted-foreground text-xs font-medium">Resultado</span>
            <span className="text-sm font-semibold">
              <Money value={projeto.resultado} tone="auto" signed />
            </span>
          </div>
        ) : null}
      </div>

      {/*
        Rodapé preso à base, junto com os selos: a grade iguala a altura dos
        cards da mesma fileira, e os dois acompanham a base em vez de boiar
        logo abaixo do conteúdo.

        À esquerda, os atalhos para os links do projeto (discretos até o mouse
        passar pelo card: dezenas de cards com cinco ícones acesos disputariam
        atenção com o status e as atrasadas). À direita, atrasadas e data. As
        duas metades existem sempre, mesmo vazias, para nada trocar de lado
        por falta do vizinho. `z-10` tira os links de baixo do link esticado
        do card, senão o clique abriria o projeto.
      */}
      {/*
        Os três filtros da tela, no card, como selo: categoria, status e
        prioridade, logo acima da linha de separação. Embaixo, e não colados
        ao nome, para o topo do card ser só a identidade do projeto, que é o
        que o olho procura numa lista. `mt-auto` prende os selos e o rodapé à
        base. A categoria repete a da seção de propósito: nem todo card fica
        perto do título da seção depois de rolar a página.
      */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <CategoryBadge category={projeto.categoria} />
        <ProjectStatusBadge status={projeto.status} />
        <PriorityBadge value={projeto.prioridade} />
        <div className="ml-auto">
          {modo === "farm" ? (
            <TirarDoFarm projeto={projeto} />
          ) : !projeto.farmando && podeFarmar(projeto.status) ? (
            <BotaoFarmar projeto={projeto} />
          ) : null}
        </div>
      </div>

      <div className="border-border mt-3 flex min-h-10 items-center justify-between gap-3 border-t pt-2.5 text-xs">
        <div className="relative z-10 -ml-1.5 min-w-0">
          <LinksDoProjeto
            nome={projeto.nome}
            links={projeto.links}
            className="text-muted-foreground/60 group-hover:text-muted-foreground group-focus-within:text-muted-foreground"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {modo === "farm" && projeto.contas > 0 ? (
            <span className="text-muted-foreground">
              {projeto.contas} {projeto.contas === 1 ? "conta" : "contas"}
            </span>
          ) : null}
          {projeto.tarefasAtrasadas > 0 ? (
            <span className="bg-negative/15 text-negative inline-flex items-center rounded-full px-2.5 py-0.5 font-medium">
              {projeto.tarefasAtrasadas} atrasada
              {projeto.tarefasAtrasadas > 1 ? "s" : ""}
            </span>
          ) : null}
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

/**
 * As duas abas de Projetos (ARCHITECTURE §21):
 *
 * - **Todos os projetos**: no topo, os destaques ativos que a pessoa ainda
 *   não tem; embaixo, os projetos dela que não estão em farm, por status.
 * - **Farmando agora**: só os que ela escolheu farmar, por categoria, com os
 *   números de cada um.
 */
export function ProjetosView({ aba }: { aba: "todos" | "farm" }) {
  const { dataset, hoje } = useDados();
  const [categoria, setCategoria] = useState<ProjectCategory | null>(null);
  const [prioridade, setPrioridade] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const daAba = selectProjects(dataset, hoje).filter((p) =>
    aba === "farm" ? p.farmando : !p.farmando,
  );

  /*
   * Busca sem acento e sem caixa: "solstice" acha "Solstïce", e "unit" acha
   * "Unit". Digitar o acento certo para achar o que se está olhando na tela é
   * exatamente o atrito que uma busca deveria remover.
   */
  const termo = normalizar(busca);

  const filtrados = daAba.filter(
    (p) =>
      (categoria === null || p.categoria === categoria) &&
      (prioridade === null || String(p.prioridade) === prioridade) &&
      (termo === "" || normalizar(p.nome).includes(termo)),
  );

  // Contagens vêm do conjunto da aba: um filtro que zera a própria contagem
  // esconderia a saída para desfazê-lo.
  const contarCategoria = (valor: ProjectCategory) =>
    daAba.filter((p) => p.categoria === valor).length;
  const contarPrioridade = (valor: number) =>
    daAba.filter((p) => p.prioridade === valor).length;

  // Dentro da seção, prioridade manda; empate desempata por capital.
  const ordenar = (lista: ProjectSummary[]) =>
    [...lista].sort((a, b) => b.prioridade - a.prioridade || b.aportado - a.aportado);

  const grupos =
    aba === "farm"
      ? ordemCategoria.map((secao) => ({
          chave: secao.chave ?? "sem-categoria",
          cabecalho: <CategoryBadge category={secao.chave} />,
          nota: secao.nota,
          projetos: ordenar(filtrados.filter((p) => p.categoria === secao.chave)),
        }))
      : ordemStatus.map((secao) => ({
          chave: secao.chave,
          cabecalho: <span>{secao.titulo}</span>,
          nota: secao.nota,
          projetos: ordenar(filtrados.filter((p) => p.status === secao.chave)),
        }));
  const visiveis = grupos.filter((g) => g.projetos.length > 0);

  const temFiltro = categoria !== null || prioridade !== null || termo !== "";
  const limpar = () => {
    setCategoria(null);
    setPrioridade(null);
    setBusca("");
  };

  return (
    <>
      <PageHeader
        icon={aba === "farm" ? Sprout : Layers}
        title={aba === "farm" ? "Farmando agora" : "Todos os projetos"}
        description={
          aba === "farm"
            ? "Os projetos que você escolheu farmar, com os números de cada um. Para sair, diga o motivo em Tirar do farm."
            : "Os farms atuais para adicionar e os seus projetos fora do farm, por status."
        }
        actions={<NovoProjeto />}
      />

      {aba === "todos" ? <SugestoesDoCatalogo /> : null}

      {daAba.length > 0 ? (
        <div className="border-border mb-8 flex flex-col gap-3 rounded-lg border p-4">
          {/*
            A busca vem antes dos chips porque é o caminho mais curto quando se
            sabe o nome: os filtros servem para explorar, e a busca para ir
            direto. Filtra ao digitar, sem botão de confirmar.
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
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setBusca("")}>
                Limpar
              </Button>
            ) : null}
          </div>

          <FiltroChips
            legenda="Categoria"
            selecionado={categoria}
            aoSelecionar={setCategoria}
            opcoes={[
              { valor: null, rotulo: "Todas", contagem: daAba.length },
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
              ...[3, 2, 1]
                .map((n) => ({
                  valor: String(n),
                  rotulo: priorityLabels[n],
                  contagem: contarPrioridade(n),
                }))
                // Não oferece filtro que não devolveria nada.
                .filter((p) => p.contagem > 0),
            ]}
          />
          {temFiltro ? (
            <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-muted-foreground text-xs">
                {filtrados.length} de {daAba.length} {daAba.length === 1 ? "projeto" : "projetos"}
              </p>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={limpar}>
                Limpar filtros
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {daAba.length === 0 ? (
        aba === "farm" ? (
          <EmptyState
            title="Você ainda não está farmando nenhum projeto"
            description="Escolha um dos farms atuais em Todos os projetos, ou cadastre um projeto ativo seu."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/projetos">Ver todos os projetos</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nenhum projeto fora do farm"
            description="Os projetos que você pausar, encerrar ou cadastrar sem farmar aparecem aqui."
          />
        )
      ) : visiveis.length === 0 ? (
        /*
         * O vazio diz o que foi procurado, e não só que não achou. Quem digitou
         * um nome quase certo precisa ver o que digitou para perceber o engano.
         */
        <EmptyState
          title={termo ? `Nenhum projeto com "${busca.trim()}"` : "Nenhum projeto com esses filtros"}
          description={
            termo
              ? "Confira a escrita, ou limpe os filtros para ver todos de novo."
              : "Ajuste a categoria ou a prioridade para ver outros projetos."
          }
          action={
            <Button variant="outline" size="sm" onClick={limpar}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {visiveis.map((grupo) => (
            <section key={grupo.chave} aria-labelledby={`grupo-${grupo.chave}`}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 id={`grupo-${grupo.chave}`} className="flex items-center gap-2 text-base font-medium">
                  {grupo.cabecalho}
                  <span className="text-muted-foreground tabular text-sm">{grupo.projetos.length}</span>
                </h2>
                {grupo.nota ? <span className="text-muted-foreground text-xs">{grupo.nota}</span> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {grupo.projetos.map((projeto) => (
                  <CardProjeto key={projeto.id} projeto={projeto} modo={aba} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
