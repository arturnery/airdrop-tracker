import { describe, expect, it } from "vitest";

import {
  exposureForPair,
  latestSnapshotByPair,
  netFlowByPair,
  pairKey,
  summarizeFinancials,
  sumOfType,
  type MovementRow,
  type SnapshotRow,
} from "@/lib/finance";
import { toDbNumeric } from "@/lib/money";

const mov = (
  projectId: string,
  accountId: string,
  type: string,
  amountUsd: string,
): MovementRow => ({ projectId, accountId, type, amountUsd });

const snap = (
  projectId: string,
  accountId: string,
  takenAt: string,
  balanceUsd: string,
): SnapshotRow => ({ projectId, accountId, takenAt, balanceUsd });

describe("latestSnapshotByPair", () => {
  it("mantém apenas o snapshot mais recente de cada par", () => {
    const result = latestSnapshotByPair([
      snap("p1", "a1", "2026-07-01", "15.00"),
      snap("p1", "a1", "2026-07-07", "7.33"),
    ]);
    expect(result.size).toBe(1);
    expect(result.get(pairKey("p1", "a1"))?.balance).toBe(733);
  });

  it("não deixa a ordem de entrada decidir o vencedor", () => {
    const antes = latestSnapshotByPair([
      snap("p1", "a1", "2026-07-07", "7.33"),
      snap("p1", "a1", "2026-07-01", "15.00"),
    ]);
    expect(antes.get(pairKey("p1", "a1"))?.balance).toBe(733);
  });

  it("separa pares diferentes", () => {
    const result = latestSnapshotByPair([
      snap("p1", "a1", "2026-07-07", "7.33"),
      snap("p1", "a2", "2026-07-07", "20.00"),
      snap("p2", "a1", "2026-07-07", "5.00"),
    ]);
    expect(result.size).toBe(3);
  });
});

describe("sumOfType", () => {
  it("soma apenas o tipo pedido", () => {
    const movements = [
      mov("p1", "a1", "deposit", "20.00"),
      mov("p1", "a1", "deposit", "9.00"),
      mov("p1", "a1", "trade_pnl", "-3.25"),
      mov("p1", "a1", "volume_traded", "2100.00"),
    ];
    expect(toDbNumeric(sumOfType(movements, "deposit"))).toBe("29.00");
    expect(toDbNumeric(sumOfType(movements, "trade_pnl"))).toBe("-3.25");
  });
});

describe("exposureForPair", () => {
  const key = pairKey("p1", "a1");

  it("usa o snapshot quando existe e marca como confirmado", () => {
    const snapshots = latestSnapshotByPair([snap("p1", "a1", "2026-07-07", "7.33")]);
    const net = netFlowByPair([mov("p1", "a1", "deposit", "20.00")]);
    const result = exposureForPair(key, snapshots, net);
    expect(result).toEqual({ value: 733, confirmed: true, takenAt: "2026-07-07" });
  });

  it("estima pelo aporte líquido quando não há snapshot", () => {
    const net = netFlowByPair([mov("p1", "a1", "deposit", "100.00")]);
    const result = exposureForPair(key, new Map(), net);
    expect(result).toEqual({ value: 10000, confirmed: false, takenAt: null });
  });

  it("desconta retirada e perda na estimativa", () => {
    const net = netFlowByPair([
      mov("p1", "a1", "deposit", "100.00"),
      mov("p1", "a1", "withdrawal", "-30.00"),
      mov("p1", "a1", "trade_pnl", "-5.00"),
    ]);
    expect(exposureForPair(key, new Map(), net).value).toBe(6500);
  });

  it("ignora volume operado na estimativa", () => {
    const net = netFlowByPair([
      mov("p1", "a1", "deposit", "20.00"),
      mov("p1", "a1", "volume_traded", "9999.00"),
    ]);
    expect(exposureForPair(key, new Map(), net).value).toBe(2000);
  });
});

describe("summarizeFinancials", () => {
  it("não conta volume operado como capital investido", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "20.00"),
        mov("p1", "a1", "volume_traded", "5000.00"),
      ],
      snapshots: [snap("p1", "a1", "2026-07-27", "22.00")],
      pairs: [{ projectId: "p1", accountId: "a1" }],
    });
    expect(toDbNumeric(resumo.aportado)).toBe("20.00");
    expect(toDbNumeric(resumo.exposicao)).toBe("22.00");
    expect(toDbNumeric(resumo.resultado)).toBe("2.00");
  });

  it("reporta cobertura de saldo confirmado", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "20.00"),
        mov("p1", "a2", "deposit", "100.00"),
      ],
      snapshots: [snap("p1", "a1", "2026-07-27", "22.00")],
      pairs: [
        { projectId: "p1", accountId: "a1" },
        { projectId: "p1", accountId: "a2" },
      ],
    });
    expect(resumo.paresComSaldo).toBe(1);
    expect(resumo.paresTotal).toBe(2);
    // a2 estimado em 100.00, a1 confirmado em 22.00
    expect(toDbNumeric(resumo.exposicao)).toBe("122.00");
  });

  it("desconta taxas do resultado", () => {
    const resumo = summarizeFinancials({
      movements: [
        mov("p1", "a1", "deposit", "100.00"),
        mov("p1", "a1", "fee_gas", "-4.00"),
      ],
      snapshots: [snap("p1", "a1", "2026-07-27", "100.00")],
      pairs: [{ projectId: "p1", accountId: "a1" }],
    });
    // (0 retirado + 100 exposição + 0 airdrop) − 100 aportado − 4 taxas
    expect(toDbNumeric(resumo.resultado)).toBe("-4.00");
  });

  it("soma airdrops recebidos no resultado", () => {
    const resumo = summarizeFinancials({
      movements: [mov("p1", "a1", "deposit", "20.00")],
      snapshots: [snap("p1", "a1", "2026-07-27", "20.00")],
      pairs: [{ projectId: "p1", accountId: "a1" }],
      airdropsUsd: ["150.00"],
    });
    expect(toDbNumeric(resumo.resultado)).toBe("150.00");
    expect(resumo.roi).toBe(750);
  });

  it("devolve ROI nulo sem aporte em vez de Infinity", () => {
    const resumo = summarizeFinancials({
      movements: [],
      snapshots: [snap("p1", "a1", "2026-07-07", "7.33")],
      pairs: [{ projectId: "p1", accountId: "a1" }],
    });
    expect(resumo.roi).toBeNull();
    expect(toDbNumeric(resumo.exposicao)).toBe("7.33");
  });

  it("conta par sem movimento nenhum como zero, não como erro", () => {
    const resumo = summarizeFinancials({
      movements: [],
      snapshots: [],
      pairs: [{ projectId: "p1", accountId: "a1" }],
    });
    expect(toDbNumeric(resumo.exposicao)).toBe("0.00");
    expect(resumo.paresComSaldo).toBe(0);
  });
});
