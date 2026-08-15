import { describe, expect, it } from "vitest";

import { diagnosticarProjeto } from "@/lib/consistencia";
import { cents } from "@/lib/money";

const l = (type: string, amountUsd: string) => ({ type, amountUsd });

const diag = (exposicao: number, lancamentos: { type: string; amountUsd: string }[]) =>
  diagnosticarProjeto({ exposicao: cents(exposicao), lancamentos });

/**
 * O caso real que motivou o aviso: um projeto exibia saldo de −US$ 640 porque a
 * perda no trade foi lançada e o depósito que a bancou não. Nada na tela dizia
 * que aquele número não podia existir.
 */
describe("saldo impossível", () => {
  it("aponta saldo negativo", () => {
    const a = diag(-64000, [l("trade_pnl", "-640.00")]);
    expect(a?.tipo).toBe("saldo_negativo");
    expect(a?.resumo).toBe("saldo negativo");
  });

  it("aponta dinheiro que se move sem nunca ter entrado", () => {
    const a = diag(20000, [l("trade_pnl", "200.00")]);
    expect(a?.tipo).toBe("sem_origem");
  });

  it("negativo vence sem-origem quando os dois valem", () => {
    // Os dois se aplicam ao BackPack. "Você tem menos de zero" é mais urgente.
    expect(diag(-64000, [l("trade_pnl", "-640.00")])?.tipo).toBe("saldo_negativo");
  });
});

describe("o que NÃO pode virar alarme falso", () => {
  it("projeto normal, com depósito e lucro", () => {
    expect(diag(14000, [l("deposit", "100.00"), l("trade_pnl", "40.00")])).toBeNull();
  });

  it("projeto que perdeu quase tudo, mas depositou", () => {
    expect(diag(100, [l("deposit", "100.00"), l("trade_pnl", "-99.00")])).toBeNull();
  });

  it("projeto zerado por retirada, que é o encerramento normal", () => {
    expect(
      diag(0, [l("deposit", "100.00"), l("withdrawal", "-100.00")]),
    ).toBeNull();
  });

  it("projeto sem lançamento nenhum", () => {
    expect(diag(0, [])).toBeNull();
  });

  it("só volume operado: é atividade, não dinheiro", () => {
    // Volume não entra no saldo, então não há saldo sem origem a apontar.
    expect(diag(0, [l("volume_traded", "50000.00")])).toBeNull();
  });

  it("ganhou e perdeu o mesmo valor sem depósito, e sobrou zero", () => {
    /* Apontar aqui seria pedir uma correção que não muda número nenhum na
       tela: o saldo já está em zero, que é onde deveria estar. */
    expect(
      diag(0, [l("trade_pnl", "200.00"), l("trade_pnl", "-200.00")]),
    ).toBeNull();
  });

  it("taxa de gas sozinha não conta como movimento sem origem", () => {
    // fee_gas não é tipo de caixa: sai do bolso, não da posição.
    expect(diag(0, [l("fee_gas", "-5.00")])).toBeNull();
  });

  it("depósito registrado afasta o aviso, mesmo com muito trade", () => {
    expect(
      diag(742000, [l("deposit", "40.00"), l("trade_pnl", "7380.00")]),
    ).toBeNull();
  });
});
