import { describe, expect, it } from "vitest";

import {
  cotacaoSchema,
  lancamentoSchema,
  perfilSchema,
  pontosSchema,
  trocaSenhaSchema,
} from "@/lib/validators";

/**
 * Estes testes existem por causa de um bug real.
 *
 * Os formulários validavam no cliente e enviavam `resultado.data`: já
 * transformado: para a Server Action, que validava de novo. Como os schemas
 * convertem string em número ("$3" → 300 centavos), a segunda validação
 * recebia número onde esperava string e recusava a própria saída, com a
 * mensagem "Invalid input: expected string, received number".
 *
 * A correção foi enviar o objeto bruto. Os testes abaixo fixam a razão: um
 * schema com transform NÃO é idempotente, então validar duas vezes o mesmo
 * dado é sempre erro de desenho.
 */

const cotacaoBruta = {
  symbol: "SOL",
  priceUsd: "195.00",
  updatedAt: "2026-08-06",
};

describe("schemas com transform não são idempotentes", () => {
  it("cotação: revalidar a saída falha", () => {
    const primeira = cotacaoSchema.safeParse(cotacaoBruta);
    expect(primeira.success).toBe(true);
    // priceUsd virou centavos (número).
    expect(primeira.data!.priceUsd).toBe(19_500);

    const segunda = cotacaoSchema.safeParse(primeira.data);
    expect(segunda.success).toBe(false);
  });

  it("lançamento: revalidar a saída falha", () => {
    const bruto = {
      projectId: "6f1c2a2e-2c4a-4c4a-8c4a-2c4a4c4a8c4a",
      accountId: "6f1c2a2e-2c4a-4c4a-8c4a-2c4a4c4a8c4b",
      occurredAt: "2026-08-06",
      type: "deposit",
      amount: "100.00",
      tokenSymbol: "SOL",
      tokenAmount: "2",
      description: "teste",
    };
    const primeira = lancamentoSchema.safeParse(bruto);
    expect(primeira.success).toBe(true);
    expect(primeira.data!.amount).toBe(10_000);

    expect(lancamentoSchema.safeParse(primeira.data).success).toBe(false);
  });

  it("pontos: revalidar a saída falha", () => {
    const bruto = {
      projectId: "6f1c2a2e-2c4a-4c4a-8c4a-2c4a4c4a8c4a",
      accountId: "6f1c2a2e-2c4a-4c4a-8c4a-2c4a4c4a8c4b",
      takenAt: "2026-08-06",
      points: "12.450",
      note: "",
    };
    const primeira = pontosSchema.safeParse(bruto);
    expect(primeira.success).toBe(true);

    expect(pontosSchema.safeParse(primeira.data).success).toBe(false);
  });

  /** O dado bruto, esse sim, pode ser validado quantas vezes for. */
  it("o bruto atravessa validações repetidas sem mudar", () => {
    const a = cotacaoSchema.safeParse(cotacaoBruta);
    const b = cotacaoSchema.safeParse(cotacaoBruta);
    expect(a.success && b.success).toBe(true);
    expect(a.data).toEqual(b.data);
  });
});

describe("valores aceitos no formulário", () => {
  it("aceita o preço com e sem símbolo", () => {
    for (const entrada of ["195", "195.00", "$195.00", "195,00"]) {
      const r = cotacaoSchema.safeParse({ ...cotacaoBruta, priceUsd: entrada });
      expect(r.success, `falhou para "${entrada}"`).toBe(true);
      expect(r.data!.priceUsd).toBe(19_500);
    }
  });

  it("normaliza o símbolo para maiúsculo", () => {
    const r = cotacaoSchema.safeParse({ ...cotacaoBruta, symbol: "sol" });
    expect(r.data!.symbol).toBe("SOL");
  });

  it("recusa preço inválido com mensagem legível", () => {
    const r = cotacaoSchema.safeParse({ ...cotacaoBruta, priceUsd: "abc" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toContain("inválido");
  });
});

describe("troca de senha", () => {
  const base = {
    atual: "senha-antiga",
    nova: "senha-nova-123",
    confirmacao: "senha-nova-123",
  };

  it("aceita quando as duas novas coincidem", () => {
    expect(trocaSenhaSchema.safeParse(base).success).toBe(true);
  });

  it("recusa confirmação diferente", () => {
    const r = trocaSenhaSchema.safeParse({ ...base, confirmacao: "outra-coisa" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(["confirmacao"]);
  });

  /**
   * Repetir a senha atual passaria despercebido e a pessoa acharia que trocou.
   * O caso é comum com senha temporária: digita a que recebeu nos três campos.
   */
  it("recusa senha nova igual à atual", () => {
    const r = trocaSenhaSchema.safeParse({
      atual: "mesma-senha-123",
      nova: "mesma-senha-123",
      confirmacao: "mesma-senha-123",
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(["nova"]);
  });

  it("exige comprimento mínimo na nova", () => {
    const r = trocaSenhaSchema.safeParse({
      ...base,
      nova: "curta",
      confirmacao: "curta",
    });
    expect(r.success).toBe(false);
  });

  it("exige a senha atual", () => {
    const r = trocaSenhaSchema.safeParse({ ...base, atual: "" });
    expect(r.success).toBe(false);
  });
});

describe("perfil", () => {
  it("aceita nome válido", () => {
    expect(perfilSchema.safeParse({ name: "Artur" }).success).toBe(true);
  });

  it("recusa nome curto demais", () => {
    expect(perfilSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("remove espaços das pontas", () => {
    const r = perfilSchema.safeParse({ name: "  Artur Nery  " });
    expect(r.data!.name).toBe("Artur Nery");
  });
});
