import { normalizar, type Dataset } from "./dataset";
import type { Cents } from "./money";
import { fromDbNumeric } from "./money";
import type { Points } from "./points";
import { selectDashboardSummary, selectProgramasDePontos } from "./selectors";

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
  pontos: Points;
  /** aaaa-mm-dd da medição mais recente do membro neste projeto. */
  atualizadoEm: string | null;
};

export type RankingDoProjeto = {
  /** Nome normalizado: é o que junta o mesmo projeto entre membros. */
  chave: string;
  nome: string;
  rotulo: string;
  linhas: LinhaDePontos[];
};

/**
 * Um ranking por projeto com programa de pontos.
 *
 * Cada membro tem a própria cópia do projeto (§13), então o "mesmo projeto"
 * entre membros é achado pelo nome normalizado: "Lighter" e "lighter" são um
 * só. O total de cada membro é o total do programa na página do projeto dele
 * (soma da última medição de cada conta). Quem nunca mediu fica de fora.
 * Projetos com mais participantes primeiro.
 */
export function rankingDePontos(membros: Membro[]): RankingDoProjeto[] {
  const porProjeto = new Map<string, RankingDoProjeto>();
  for (const m of membros) {
    for (const programa of selectProgramasDePontos(m.ds)) {
      if (programa.atualizadoEm === null) continue;
      const chave = normalizar(programa.projetoNome);
      const ranking = porProjeto.get(chave) ?? {
        chave,
        nome: programa.projetoNome,
        rotulo: programa.rotulo,
        linhas: [],
      };
      ranking.linhas.push({
        userId: m.userId,
        nome: m.nome,
        posicao: 0,
        pontos: programa.total,
        atualizadoEm: programa.atualizadoEm,
      });
      porProjeto.set(chave, ranking);
    }
  }
  return [...porProjeto.values()]
    .map((r) => ({
      ...r,
      linhas: comPosicao(
        [...r.linhas].sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR")),
        (l) => l.pontos,
      ),
    }))
    .sort((a, b) => b.linhas.length - a.linhas.length || a.nome.localeCompare(b.nome, "pt-BR"));
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
