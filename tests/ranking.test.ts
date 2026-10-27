import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import { emptyDataset, type Dataset } from "@/lib/dataset";
import { airdropsRecentes, ordenarRanking, rankingDePontos, rankingDeResultado, type Membro } from "@/lib/ranking";
import { selectDashboardSummary, selectProgramasDePontos, selectVolumeDoProjeto } from "@/lib/selectors";

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
    volume?: [data: string, valor: string][];
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
  ds.volumeSnapshots = (extra.volume ?? []).map(([takenAt, volumeUsd], i) => ({
    id: `${userId}-v${i}`,
    projectId: pid,
    accountId: aid,
    takenAt,
    volumeUsd,
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

/** Os destaques ativos dos testes: cada membro adota pelo id do catálogo. */
const lighter = { id: "cat-lighter", nome: "Lighter", sourceProjectId: null };
const monad = { id: "cat-monad", nome: "Monad", sourceProjectId: null };
const adotou = (m: Membro, catalogId: string): Membro => ({
  ...m,
  ds: { ...m.ds, projects: m.ds.projects.map((p) => ({ ...p, adoptedFromId: catalogId })) },
});

describe("rankingDePontos", () => {
  it("só os projetos ativos destacados, ligados pelo destaque e não pelo nome", () => {
    const projetos = rankingDePontos(
      [
        adotou(membro("ana", "Ana", { pontos: [["2026-03-01", "1200"]] }), "cat-lighter"),
        adotou(membro("bia", "Bia", { pontos: [["2026-03-02", "3400"]] }), "cat-lighter"),
        // Mesmo nome, mas cadastrado à mão: é pessoal e não entra.
        membro("caio", "Caio", { projeto: "Lighter", pontos: [["2026-03-02", "9999"]] }),
      ],
      [lighter],
    );
    expect(projetos.map((p) => [p.nome, p.linhas.length])).toEqual([["Lighter", 2]]);
    expect(projetos[0]!.linhas.map((l) => l.nome)).toEqual(["Bia", "Ana"]);
  });

  it("projeto ativo aparece mesmo antes de alguém medir", () => {
    const projetos = rankingDePontos([adotou(membro("ana", "Ana", { pontos: [["2026-03-01", "10"]] }), "cat-lighter")], [lighter, monad]);
    expect(projetos.map((p) => [p.nome, p.linhas.length])).toEqual([
      ["Lighter", 1],
      ["Monad", 0],
    ]);
  });

  it("quem publicou entra pelo projeto de origem", () => {
    const admin = membro("adm", "Admin", { pontos: [["2026-03-01", "70"]] });
    const origem = { ...lighter, sourceProjectId: admin.ds.projects[0]!.id };
    expect(rankingDePontos([admin], [origem])[0]!.linhas.map((l) => l.nome)).toEqual(["Admin"]);
  });

  it("o total do membro é o mesmo da página do projeto dele", () => {
    const ana = adotou(membro("ana", "Ana", { pontos: [["2026-03-01", "1000"], ["2026-03-08", "1800"]] }), "cat-lighter");
    const [projeto] = rankingDePontos([ana], [lighter]);
    expect(projeto!.linhas[0]!.pontos).toBe(selectProgramasDePontos(ana.ds)[0]!.total);
  });

  it("quem não mediu nada no projeto não aparece nele", () => {
    const [projeto] = rankingDePontos([adotou(membro("ana", "Ana"), "cat-lighter")], [lighter]);
    expect(projeto!.linhas).toEqual([]);
  });
});

describe("rankingDePontos com volume", () => {
  it("mostra pontos e volume lado a lado, com o mesmo total da página do projeto", () => {
    const ana = adotou(membro("ana", "Ana", { pontos: [["2026-03-01", "500"]], volume: [["2026-03-01", "12000"], ["2026-03-05", "15000"]] }), "cat-lighter");
    const [projeto] = rankingDePontos([ana], [lighter]);
    expect(projeto!.linhas[0]!.volume).toBe(selectVolumeDoProjeto(ana.ds, ana.ds.projects[0]!.id).total);
    expect(projeto!.linhas[0]!.atualizadoEm).toBe("2026-03-05");
    expect(projeto).toMatchObject({ temPontos: true, temVolume: true });
  });

  it("projeto só com volume é ordenado por volume", () => {
    const [projeto] = rankingDePontos(
      [
        adotou(membro("ana", "Ana", { pontosLabel: null, volume: [["2026-03-01", "100"]] }), "cat-lighter"),
        adotou(membro("bia", "Bia", { pontosLabel: null, volume: [["2026-03-01", "900"]] }), "cat-lighter"),
      ],
      [lighter],
    );
    expect(projeto).toMatchObject({ temPontos: false, rotulo: null });
    expect(projeto!.linhas.map((l) => [l.nome, l.posicao])).toEqual([
      ["Bia", 1],
      ["Ana", 2],
    ]);
  });

  it("quem não mede a grandeza escolhida fica no fim, sem posição", () => {
    const [projeto] = rankingDePontos(
      [
        adotou(membro("ana", "Ana", { pontos: [["2026-03-01", "500"]] }), "cat-lighter"),
        adotou(membro("bia", "Bia", { volume: [["2026-03-01", "900"]] }), "cat-lighter"),
      ],
      [lighter],
    );
    expect(ordenarRanking(projeto!.linhas, "pontos").map((l) => [l.nome, l.posicao])).toEqual([
      ["Ana", 1],
      ["Bia", 0],
    ]);
    expect(ordenarRanking(projeto!.linhas, "volume").map((l) => [l.nome, l.posicao])).toEqual([
      ["Bia", 1],
      ["Ana", 0],
    ]);
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

describe("contas de cada membro no ranking de pontos e volume", () => {
  it("duas contas aparecem separadas, e o total do membro é a soma delas", () => {
    const base = adotou(membro("ana", "Ana", { pontos: [["2026-03-01", "1000"]], volume: [["2026-03-01", "5000"]] }), "cat-lighter");
    const pid = base.ds.projects[0]!.id;
    const ds = {
      ...base.ds,
      accounts: [...base.ds.accounts, { id: "ana-b", label: "Rabby 2", walletAddress: "0xsegredo", email: null, isActive: true }],
      projectAccounts: [...base.ds.projectAccounts, { projectId: pid, accountId: "ana-b", status: "ativa" as const, startedAt: "2026-01-01" }],
      pointsSnapshots: [...base.ds.pointsSnapshots, { id: "pb", projectId: pid, accountId: "ana-b", takenAt: "2026-03-05", points: "3000", note: null }],
    };
    const [projeto] = rankingDePontos([{ ...base, ds }], [lighter]);
    const linha = projeto!.linhas[0]!;
    expect(linha.contas.map((c) => c.conta)).toEqual(["Rabby 2", "conta"]);
    expect(linha.contas.reduce((t, c) => t + (c.pontos ?? 0), 0)).toBe(linha.pontos);
    expect(linha.contas.find((c) => c.conta === "conta")).toMatchObject({ volume: 500000 });
    expect(linha.contas.find((c) => c.conta === "Rabby 2")).toMatchObject({ volume: null, atualizadoEm: "2026-03-05" });
    // Só o nome da conta: o endereço da carteira não vai para o ranking.
    expect(JSON.stringify(linha)).not.toContain("0xsegredo");
  });
});
