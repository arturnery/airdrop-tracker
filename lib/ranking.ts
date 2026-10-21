import { normalizar, type Dataset } from "./dataset";
import type { Cents } from "./money";
import { fromDbNumeric } from "./money";
import type { Points } from "./points";
import { selectDashboardSummary, selectProgramasDePontos, selectVolumeDoProjeto } from "./selectors";

/**
 * Ranking da comunidade (ARCHITECTURE §22): resultado e pontos de cada
 * membro, lado a lado.
 *
 * Cada membro chega como o próprio Dataset, montado do banco pela mesma
 * conversão de sempre, e os números saem dos **mesmos selectors** da Visão
 * geral e da página do projeto. É o que garante que o valor no ranking é o
 * que a pessoa vê na conta dela, e não uma segunda conta que diverge com o
 * tempo.
 */

export type Membro = { userId: string; nome: string; ds: Dataset };

export type LinhaDeResultado = {
  userId: string;
  nome: string;
  posicao: number;
  /** O "Resultado" da Visão geral: airdrops, rendimento, trade, menos taxas. */
  resultado: Cents;
  /** Só o que veio de airdrop, a parte que o ranking celebra. */
  airdrops: Cents;
  /** De quantos projetos o airdrop já caiu. */
  projetosComAirdrop: number;
};

/**
 * Do maior resultado para o menor. Quem ainda não tem nenhum lançamento fica
 * de fora: um membro recém-chegado com zero não está "em último", só ainda
 * não começou. Empate divide a posição (dois em 2º, o seguinte é 4º).
 */
export function rankingDeResultado(membros: Membro[]): LinhaDeResultado[] {
  const linhas = membros
    .filter((m) => m.ds.transactions.length > 0 || m.ds.airdropClaims.length > 0)
    .map((m) => {
      const resumo = selectDashboardSummary(m.ds, "1970-01-01");
      return {
        userId: m.userId,
        nome: m.nome,
        posicao: 0,
        resultado: resumo.resultado,
        airdrops: resumo.airdrops,
        projetosComAirdrop: resumo.airdropsGanhos,
      };
    })
    .sort((a, b) => b.resultado - a.resultado || a.nome.localeCompare(b.nome, "pt-BR"));
  return comPosicao(linhas, (l) => l.resultado);
}

export type AirdropRecente = {
  userId: string;
  nome: string;
  projeto: string;
  token: string;
  valor: Cents;
  /** aaaa-mm-dd */
  data: string;
};

/**
 * Os últimos airdrops registrados na comunidade, para o "quem recebeu o quê".
 * Recebimentos do mesmo membro, projeto e dia viram uma linha só: duas contas
 * da mesma pessoa recebendo o mesmo airdrop é um acontecimento, não dois.
 */
export function airdropsRecentes(membros: Membro[], limite = 15): AirdropRecente[] {
  const porChave = new Map<string, AirdropRecente>();
  for (const m of membros) {
    for (const c of m.ds.airdropClaims) {
      const projeto = m.ds.projects.find((p) => p.id === c.projectId)?.name ?? "Projeto";
      const chave = `${m.userId}|${c.projectId}|${c.receivedAt}`;
      const atual = porChave.get(chave);
      const valor = fromDbNumeric(c.valueUsd);
      if (atual) atual.valor = (atual.valor + valor) as Cents;
      else
        porChave.set(chave, {
          userId: m.userId,
          nome: m.nome,
          projeto,
          token: c.tokenSymbol,
          valor,
          data: c.receivedAt,
        });
    }
  }
  return [...porChave.values()]
    .sort((a, b) => b.data.localeCompare(a.data) || b.valor - a.valor)
    .slice(0, limite);
}

export type LinhaDePontos = {
  userId: string;
  nome: string;
  posicao: number;
  /** null quando o membro não mede pontos neste projeto (ou ele não tem programa). */
  pontos: Points | null;
  /** Volume acumulado, em centavos; null quando o membro não mede volume aqui. */
  volume: Cents | null;
  /** aaaa-mm-dd da medição mais recente do membro neste projeto, de pontos ou volume. */
  atualizadoEm: string | null;
};

export type OrdemDoRanking = "pontos" | "volume";

export type RankingDoProjeto = {
  /** Nome normalizado: é o que junta o mesmo projeto entre membros. */
  chave: string;
  nome: string;
  /** Rótulo do programa de pontos ("Pontos", "XP"); null se ninguém mede pontos aqui. */
  rotulo: string | null;
  temPontos: boolean;
  temVolume: boolean;
  /** Já ordenadas pela ordem padrão: pontos quando existem, senão volume. */
  linhas: LinhaDePontos[];
};

/**
 * Um ranking por projeto, com pontos e volume lado a lado.
 *
 * Cada membro tem a própria cópia do projeto (§13), então o "mesmo projeto"
 * entre membros é achado pelo nome normalizado: "Lighter" e "lighter" são um
 * só. Os números são os mesmos da página do projeto de cada um: o total do
 * programa de pontos (`selectProgramasDePontos`) e o volume acumulado
 * (`selectVolumeDoProjeto`), soma da última medição de cada conta. Entra quem
 * mediu pelo menos um dos dois. Projetos com mais participantes primeiro.
 */
export function rankingDePontos(membros: Membro[]): RankingDoProjeto[] {
  const porProjeto = new Map<string, RankingDoProjeto>();
  for (const m of membros) {
    const programas = new Map(selectProgramasDePontos(m.ds).map((p) => [p.projetoId, p]));
    for (const projeto of m.ds.projects) {
      const programa = programas.get(projeto.id);
      const pontos = programa && programa.atualizadoEm !== null ? programa.total : null;
      const vol = selectVolumeDoProjeto(m.ds, projeto.id);
      const volume = vol.atualizadoEm !== null ? vol.total : null;
      if (pontos === null && volume === null) continue;

      const chave = normalizar(projeto.name);
      const ranking = porProjeto.get(chave) ?? {
        chave,
        nome: projeto.name,
        rotulo: null,
        temPontos: false,
        temVolume: false,
        linhas: [],
      };
      if (pontos !== null) {
        ranking.temPontos = true;
        ranking.rotulo ??= programa!.rotulo;
      }
      if (volume !== null) ranking.temVolume = true;
      const datas = [programa?.atualizadoEm, vol.atualizadoEm].filter((d): d is string => Boolean(d)).sort();
      ranking.linhas.push({
        userId: m.userId,
        nome: m.nome,
        posicao: 0,
        pontos,
        volume,
        atualizadoEm: datas.at(-1) ?? null,
      });
      porProjeto.set(chave, ranking);
    }
  }
  return [...porProjeto.values()]
    .map((r) => ({ ...r, linhas: ordenarRanking(r.linhas, r.temPontos ? "pontos" : "volume") }))
    .sort((a, b) => b.linhas.length - a.linhas.length || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Ordena (e numera) as linhas por pontos ou por volume. Quem não mede a
 * grandeza escolhida vai para o fim, sem posição própria: não está em último,
 * só não participa daquela régua.
 */
export function ordenarRanking(linhas: LinhaDePontos[], por: OrdemDoRanking): LinhaDePontos[] {
  const valor = (l: LinhaDePontos) => (por === "pontos" ? l.pontos : l.volume);
  const com = linhas.filter((l) => valor(l) !== null);
  const sem = linhas.filter((l) => valor(l) === null);
  const ordenadas = comPosicao(
    [...com]
      .map((l) => ({ ...l }))
      .sort((a, b) => valor(b)! - valor(a)! || a.nome.localeCompare(b.nome, "pt-BR")),
    (l) => valor(l)!,
  );
  return [
    ...ordenadas,
    ...[...sem].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((l) => ({ ...l, posicao: 0 })),
  ];
}

/** Posição com empate dividido: [10, 8, 8, 5] dá 1º, 2º, 2º, 4º. */
function comPosicao<T extends { posicao: number }>(ordenadas: T[], valor: (l: T) => number): T[] {
  return ordenadas.map((linha, i) => {
    const anterior = ordenadas[i - 1];
    const posicao = i > 0 && anterior && valor(anterior) === valor(linha) ? anterior.posicao : i + 1;
    linha.posicao = posicao;
    return linha;
  });
}
