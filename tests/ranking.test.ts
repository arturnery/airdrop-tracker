import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import { emptyDataset, type Dataset } from "@/lib/dataset";
import { airdropsRecentes, rankingDePontos, rankingDeResultado, type Membro } from "@/lib/ranking";
import { selectDashboardSummary, selectProgramasDePontos } from "@/lib/selectors";

/** Um membro com um projeto, uma conta e o que se passar. */
function membro(
  userId: string,
  nome: string,
  extra: {
    projeto?: string;
    pontosLabel?: string | null;
    lancamentos?: [type: Dataset["transactions"][number]["type"], valor: string][];
    airdrops?: [data: string, valor: string][];
    pontos?: [data: string, valor: string][];
  } = {},
): Membro {
  const ds = emptyDataset();
  const pid = `${userId}-p`;
  const aid = `${userId}-a`;
  ds.accounts = [{ id: aid, label: "conta", walletAddress: null, email: null, isActive: true }];
  ds.projects = [
    {
      ...datasetInicial().projects[0]!,
      id: pid,
      slug: "p",
      name: extra.projeto ?? "Lighter",
      pointsLabel: extra.pontosLabel === undefined ? "Pontos" : extra.pontosLabel,
    },
  ];
  ds.projectAccounts = [{ projectId: pid, accountId: aid, status: "ativa", startedAt: "2026-01-01" }];
  ds.transactions = (extra.lancamentos ?? []).map(([type, amountUsd], i) => ({
    id: `${userId}-t${i}`,
    projectId: pid,
    accountId: aid,
    occurredAt: "2026-02-01",
    type,
    amountUsd,
    tokenSymbol: null,
    tokenAmount: null,
    description: null,
  }));
  ds.airdropClaims = (extra.airdrops ?? []).map(([receivedAt, valueUsd], i) => ({
    id: `${userId}-c${i}`,
    projectId: pid,
    accountId: aid,
    receivedAt,
    tokenSymbol: "LIT",
    tokenAmount: null,
    priceUsd: null,
    valueUsd,
  }));
  ds.pointsSnapshots = (extra.pontos ?? []).map(([takenAt, points], i) => ({
    id: `${userId}-s${i}`,
    projectId: pid,
    accountId: aid,
    takenAt,
    points,
    note: null,
  }));
  return { userId, nome, ds };
}

describe("rankingDeResultado", () => {
  it("é o mesmo Resultado da Visão geral de cada membro", () => {
    const membros = [
      { userId: "demo", nome: "Demo", ds: datasetInicial() },
      membro("ana", "Ana", { lancamentos: [["deposit", "100"], ["trade_pnl", "-30"]], airdrops: [["2026-03-01", "500"]] }),
    ];
    for (const linha of rankingDeResultado(membros)) {
      const ds = membros.find((m) => m.userId === linha.userId)!.ds;
      expect(linha.resultado).toBe(selectDashboardSummary(ds, "1970-01-01").resultado);
    }
  });

  it("ordena do maior para o menor, e quem não lançou nada fica de fora", () => {
    const linhas = rankingDeResultado([
      membro("ana", "Ana", { airdrops: [["2026-03-01", "500"]] }),
      membro("bia", "Bia", { lancamentos: [["deposit", "100"], ["trade_pnl", "-40"]] }),
      membro("caio", "Caio", { airdrops: [["2026-03-01", "900"]] }),
      membro("novo", "Novo"),
    ]);
    expect(linhas.map((l) => [l.nome, l.posicao])).toEqual([
      ["Caio", 1],
      ["Ana", 2],
      ["Bia", 3],
    ]);
  });

  it("empate divide a posição, e a seguinte pula", () => {
    const linhas = rankingDeResultado([
      membro("a", "A", { airdrops: [["2026-03-01", "100"]] }),
      membro("b", "B", { airdrops: [["2026-03-01", "50"]] }),
      membro("c", "C", { airdrops: [["2026-03-01", "50"]] }),
      membro("d", "D", { airdrops: [["2026-03-01", "10"]] }),
    ]);
    expect(linhas.map((l) => l.posicao)).toEqual([1, 2, 2, 4]);
  });
});

describe("rankingDePontos", () => {
  it("junta o mesmo projeto entre membros pelo nome, sem caixa nem acento", () => {
    const projetos = rankingDePontos([
      membro("ana", "Ana", { projeto: "Lighter", pontos: [["2026-03-01", "1200"]] }),
      membro("bia", "Bia", { projeto: "lighter", pontos: [["2026-03-02", "3400"]] }),
      membro("caio", "Caio", { projeto: "Monad", pontos: [["2026-03-02", "50"]] }),
    ]);
    expect(projetos.map((p) => [p.nome, p.linhas.length])).toEqual([
      ["Lighter", 2],
      ["Monad", 1],
    ]);
    expect(projetos[0]!.linhas.map((l) => l.nome)).toEqual(["Bia", "Ana"]);
  });

  it("o total do membro é o mesmo da página do projeto dele", () => {
    const ana = membro("ana", "Ana", { pontos: [["2026-03-01", "1000"], ["2026-03-08", "1800"]] });
    const [projeto] = rankingDePontos([ana]);
    expect(projeto!.linhas[0]!.pontos).toBe(selectProgramasDePontos(ana.ds)[0]!.total);
  });

  it("quem nunca mediu, ou projeto sem programa de pontos, fica de fora", () => {
    expect(rankingDePontos([membro("ana", "Ana"), membro("bia", "Bia", { pontosLabel: null })])).toEqual([]);
  });
});

describe("airdropsRecentes", () => {
  it("mais recentes primeiro, juntando o mesmo membro, projeto e dia", () => {
    const ana = membro("ana", "Ana", { airdrops: [["2026-03-01", "100"], ["2026-03-01", "50"], ["2026-01-10", "20"]] });
    const recentes = airdropsRecentes([ana]);
    expect(recentes.map((r) => [r.data, r.valor])).toEqual([
      ["2026-03-01", 15000],
      ["2026-01-10", 2000],
    ]);
  });
});
