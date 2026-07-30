import { describe, expect, it } from "vitest";

import { datasetInicial } from "@/db/queries/fixtures";
import * as M from "@/lib/mutations";
import {
  addPoints,
  formatPoints,
  formatPointsDelta,
  fromDbPoints,
  parsePointsInput,
  percentGrowth,
  points,
  PointsError,
  subtractPoints,
  toDbPoints,
  ZERO_PONTOS,
} from "@/lib/points";
import {
  selectHistoricoDePontos,
  selectProgramaDePontos,
  selectProgramasDePontos,
} from "@/lib/selectors";

const base = () => datasetInicial();
const HOJE = "2026-07-30";

describe("conversão de pontos", () => {
  it("lê o numeric do banco", () => {
    expect(fromDbPoints("8400.0000")).toBe(84_000_000);
    expect(fromDbPoints("4850.5000")).toBe(48_505_000);
    expect(fromDbPoints(null)).toBe(0);
  });

  it("faz ida e volta sem perder precisão", () => {
    for (const bruto of ["0.0000", "1250.0000", "4850.5000", "999999.1234"]) {
      expect(toDbPoints(fromDbPoints(bruto))).toBe(bruto);
    }
  });

  it("rejeita lixo em vez de devolver NaN", () => {
    expect(() => fromDbPoints("abc")).toThrow(PointsError);
  });

  it("recusa escala fracionada", () => {
    expect(() => points(1.5)).toThrow(PointsError);
  });
});

describe("entrada do usuário", () => {
  it("aceita o formato que as plataformas exibem", () => {
    expect(parsePointsInput("12.450")).toEqual({ ok: true, value: 124_500_000 });
    expect(parsePointsInput("12,450")).toEqual({ ok: true, value: 124_500_000 });
    expect(parsePointsInput("1234")).toEqual({ ok: true, value: 12_340_000 });
  });

  it("aceita casas decimais", () => {
    expect(parsePointsInput("4850.5")).toEqual({ ok: true, value: 48_505_000 });
    expect(parsePointsInput("100,25")).toEqual({ ok: true, value: 1_002_500 });
  });

  it("ignora sufixo de unidade", () => {
    expect(parsePointsInput("500 pts")).toEqual({ ok: true, value: 5_000_000 });
  });

  it("recusa entrada inválida", () => {
    expect(parsePointsInput("")).toMatchObject({ ok: false });
    expect(parsePointsInput("abc")).toMatchObject({ ok: false });
    expect(parsePointsInput("1.5,5")).toMatchObject({ ok: false });
  });

  it("recusa precisão além do suportado", () => {
    expect(parsePointsInput("1.12345")).toMatchObject({ ok: false });
  });
});

describe("formatação", () => {
  it("omite decimais quando o valor é inteiro", () => {
    expect(formatPoints(points(124_500_000))).toBe("12.450");
    expect(formatPoints(ZERO_PONTOS)).toBe("0");
  });

  it("mostra decimais quando existem", () => {
    expect(formatPoints(points(48_505_000))).toBe("4.850,5");
  });

  it("formata variação com sinal", () => {
    expect(formatPointsDelta(points(33_500_000))).toBe("+3.350");
    expect(formatPointsDelta(points(-5_000_000))).toBe("−500");
    expect(formatPointsDelta(ZERO_PONTOS)).toBe("0");
  });
});

describe("aritmética", () => {
  it("soma e subtrai sem erro de ponto flutuante", () => {
    const total = addPoints(points(1_000), points(2_000));
    expect(total).toBe(3_000);
    expect(subtractPoints(points(3_000), points(1_000))).toBe(2_000);
  });

  it("calcula crescimento percentual", () => {
    expect(percentGrowth(points(120), points(100))).toBe(20);
    expect(percentGrowth(points(100), ZERO_PONTOS)).toBeNull();
  });
});

describe("selectProgramasDePontos", () => {
  const programas = selectProgramasDePontos(base());

  it("inclui só projetos com programa declarado", () => {
    // Nansen e Minara não têm pointsLabel.
    expect(programas.map((p) => p.projetoNome).sort()).toEqual([
      "Lighter",
      "Ondo Perp",
      "Saturn",
    ]);
  });

  it("soma as contas dentro do projeto", () => {
    const ondo = programas.find((p) => p.projetoSlug === "ondo-perp")!;
    // 11750 + 21400 + 1480 + 1620
    expect(formatPoints(ondo.total)).toBe("36.250");
  });

  it("calcula a variação desde a medição anterior de cada conta", () => {
    const ondo = programas.find((p) => p.projetoSlug === "ondo-perp")!;
    // (11750-8400) + (21400-15200) + (1480-1100) + (1620-1250)
    expect(formatPoints(ondo.variacao!)).toBe("10.300");
    expect(formatPoints(ondo.totalAnterior!)).toBe("25.950");
  });

  it("devolve variação nula quando o programa tem uma medição só", () => {
    const saturn = programas.find((p) => p.projetoSlug === "saturn")!;
    expect(saturn.variacao).toBeNull();
    expect(saturn.crescimento).toBeNull();
    expect(formatPoints(saturn.total)).toBe("500");
  });

  it("usa o rótulo que o projeto definiu", () => {
    expect(programas.find((p) => p.projetoSlug === "saturn")?.rotulo).toBe("XP");
    expect(programas.find((p) => p.projetoSlug === "lighter")?.rotulo).toBe("Pontos");
  });

  it("ordena pelo maior ganho", () => {
    expect(programas[0]?.projetoSlug).toBe("ondo-perp");
  });

  it("marca conta sem registro como nula, não como zero", () => {
    // Vincula uma conta nova ao Lighter, sem registrar pontos.
    const ds = M.vincularConta(base(), {
      projectId: "prj-lighter",
      accountId: "acc-brave",
      status: "ativa",
      startedAt: HOJE,
    });
    const lighter = selectProgramaDePontos(ds, "prj-lighter")!;
    const brave = lighter.contas.find((c) => c.label === "brave")!;
    expect(brave.total).toBeNull();
    // O total do projeto não muda por causa de uma conta sem medição.
    expect(formatPoints(lighter.total)).toBe("4.850,5");
  });
});

describe("registro de pontos", () => {
  it("acrescenta uma medição e recalcula o ganho", () => {
    const ds = M.registrarPontos(base(), {
      projectId: "prj-lighter",
      accountId: "acc-chrome",
      takenAt: HOJE,
      points: points(60_000_000), // 6.000
      note: "Semana boa",
    });
    const lighter = selectProgramaDePontos(ds, "prj-lighter")!;
    expect(formatPoints(lighter.total)).toBe("6.000");
    // 6000 − 4850,5
    expect(formatPoints(lighter.variacao!)).toBe("1.149,5");
  });

  it("substitui a medição do mesmo dia em vez de duplicar", () => {
    let ds = M.registrarPontos(base(), {
      projectId: "prj-saturn",
      accountId: "acc-mbox",
      takenAt: "2026-07-28",
      points: points(9_000_000),
      note: null,
    });
    ds = M.registrarPontos(ds, {
      projectId: "prj-saturn",
      accountId: "acc-mbox",
      takenAt: "2026-07-28",
      points: points(9_500_000),
      note: "corrigido",
    });
    const doDia = ds.pointsSnapshots.filter(
      (p) =>
        p.projectId === "prj-saturn" &&
        p.accountId === "acc-mbox" &&
        p.takenAt === "2026-07-28",
    );
    expect(doDia).toHaveLength(1);
    expect(doDia[0]?.note).toBe("corrigido");
  });

  it("pontos não afetam nenhum número financeiro", () => {
    const ds = M.registrarPontos(base(), {
      projectId: "prj-ondo",
      accountId: "acc-brave",
      takenAt: HOJE,
      points: points(999_000_000),
      note: null,
    });
    // Aporte, exposição e resultado permanecem intactos.
    expect(ds.transactions).toEqual(base().transactions);
    expect(ds.balanceSnapshots).toEqual(base().balanceSnapshots);
  });

  it("excluir medição remove o ganho correspondente", () => {
    const ds = M.excluirPontos(base(), "pts-05");
    const ondo = selectProgramaDePontos(ds, "prj-ondo")!;
    // brave volta a ter só a medição de 20/07, sem variação.
    const brave = ondo.contas.find((c) => c.label === "brave")!;
    expect(brave.variacao).toBeNull();
    expect(formatPoints(brave.total!)).toBe("8.400");
  });
});

describe("histórico de medições", () => {
  const historico = selectHistoricoDePontos(base(), "prj-ondo");

  it("lista do mais recente para o mais antigo", () => {
    const datas = historico.map((h) => h.data);
    expect(datas).toEqual([...datas].sort((a, b) => b.localeCompare(a)));
  });

  it("calcula o ganho em relação à medição anterior da mesma conta", () => {
    const braveRecente = historico.find(
      (h) => h.contaLabel === "brave" && h.data === "2026-07-27",
    )!;
    expect(formatPoints(braveRecente.variacao!)).toBe("3.350");
  });

  it("primeira medição de cada conta não tem ganho", () => {
    const primeira = historico.find(
      (h) => h.contaLabel === "brave" && h.data === "2026-07-20",
    )!;
    expect(primeira.variacao).toBeNull();
  });

  it("preserva a observação", () => {
    const comNota = historico.find((h) => h.nota !== null);
    expect(comNota?.nota).toBe("Semana de volume alto");
  });
});

describe("descrição no saldo em dólar", () => {
  it("grava a nota junto do saldo", () => {
    const ds = M.registrarSaldo(base(), {
      projectId: "prj-saturn",
      accountId: "acc-mbox",
      takenAt: HOJE,
      balance: 10_500 as never,
      note: "Rendimento do DeFi",
    });
    const registro = ds.balanceSnapshots.find(
      (s) => s.projectId === "prj-saturn" && s.takenAt === HOJE,
    )!;
    expect(registro.note).toBe("Rendimento do DeFi");
  });

  it("a nota aparece no histórico do projeto", async () => {
    const { selectProjectBySlug } = await import("@/lib/selectors");
    const nansen = selectProjectBySlug(base(), "nansen", HOJE)!;
    const comNota = nansen.historico.find((h) => h.descricao === "Perda em trade");
    expect(comNota?.isSnapshot).toBe(true);
  });
});
