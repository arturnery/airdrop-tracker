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
    // Meridian e Solstice não têm pointsLabel.
    expect(programas.map((p) => p.projetoNome).sort()).toEqual([
      "Nebula",
      "Prisma DEX",
      "Vertex Perp",
    ]);
  });

  it("soma as contas dentro do projeto", () => {
    const projeto = programas.find((p) => p.projetoSlug === "vertex-perp")!;
    // 11750 + 21400 + 1480 + 1620
    expect(formatPoints(projeto.total)).toBe("36.250");
  });

  it("calcula a variação desde a medição anterior de cada conta", () => {
    const projeto = programas.find((p) => p.projetoSlug === "vertex-perp")!;
    // (11750-8400) + (21400-15200) + (1480-1100) + (1620-1250)
    expect(formatPoints(projeto.variacao!)).toBe("10.300");
    expect(formatPoints(projeto.totalAnterior!)).toBe("25.950");
  });

  it("devolve variação nula quando o programa tem uma medição só", () => {
    const nebula = programas.find((p) => p.projetoSlug === "nebula")!;
    expect(nebula.variacao).toBeNull();
    expect(nebula.crescimento).toBeNull();
    expect(formatPoints(nebula.total)).toBe("500");
  });

  it("usa o rótulo que o projeto definiu", () => {
    expect(programas.find((p) => p.projetoSlug === "nebula")?.rotulo).toBe("XP");
    expect(programas.find((p) => p.projetoSlug === "prisma-dex")?.rotulo).toBe("Pontos");
  });

  it("ordena pelo maior ganho", () => {
    expect(programas[0]?.projetoSlug).toBe("vertex-perp");
  });

  it("marca conta sem registro como nula, não como zero", () => {
    // Vincula uma conta nova ao Prisma DEX, sem registrar pontos.
    const ds = M.vincularConta(base(), {
      projectId: "prj-prisma",
      accountId: "acc-brave",
      status: "ativa",
      startedAt: HOJE,
    });
    const prisma = selectProgramaDePontos(ds, "prj-prisma")!;
    const brave = prisma.contas.find((c) => c.label === "brave")!;
    expect(brave.total).toBeNull();
    // O total do projeto não muda por causa de uma conta sem medição.
    expect(formatPoints(prisma.total)).toBe("4.850,5");
  });
});

describe("registro de pontos", () => {
  it("acrescenta uma medição e recalcula o ganho", () => {
    const ds = M.registrarPontos(base(), {
      projectId: "prj-prisma",
      accountId: "acc-chrome",
      takenAt: HOJE,
      points: points(60_000_000), // 6.000
      note: "Semana boa",
    });
    const prisma = selectProgramaDePontos(ds, "prj-prisma")!;
    expect(formatPoints(prisma.total)).toBe("6.000");
    // 6000 − 4850,5
    expect(formatPoints(prisma.variacao!)).toBe("1.149,5");
  });

  it("substitui a medição do mesmo dia em vez de duplicar", () => {
    let ds = M.registrarPontos(base(), {
      projectId: "prj-nebula",
      accountId: "acc-mbox",
      takenAt: "2026-07-28",
      points: points(9_000_000),
      note: null,
    });
    ds = M.registrarPontos(ds, {
      projectId: "prj-nebula",
      accountId: "acc-mbox",
      takenAt: "2026-07-28",
      points: points(9_500_000),
      note: "corrigido",
    });
    const doDia = ds.pointsSnapshots.filter(
      (p) =>
        p.projectId === "prj-nebula" &&
        p.accountId === "acc-mbox" &&
        p.takenAt === "2026-07-28",
    );
    expect(doDia).toHaveLength(1);
    expect(doDia[0]?.note).toBe("corrigido");
  });

  it("pontos não afetam nenhum número financeiro", () => {
    const ds = M.registrarPontos(base(), {
      projectId: "prj-vertex",
      accountId: "acc-brave",
      takenAt: HOJE,
      points: points(999_000_000),
      note: null,
    });
    // Aporte, exposição e resultado permanecem intactos.
    expect(ds.transactions).toEqual(base().transactions);
  });

  it("excluir medição remove o ganho correspondente", () => {
    const ds = M.excluirPontos(base(), "pts-05");
    const projeto = selectProgramaDePontos(ds, "prj-vertex")!;
    // brave volta a ter só a medição de 20/07, sem variação.
    const brave = projeto.contas.find((c) => c.label === "brave")!;
    expect(brave.variacao).toBeNull();
    expect(formatPoints(brave.total!)).toBe("8.400");
  });
});

describe("histórico de medições", () => {
  const historico = selectHistoricoDePontos(base(), "prj-vertex");

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
