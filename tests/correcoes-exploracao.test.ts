import { describe, expect, it } from "vitest";

import { formatarValorDaMeta, formatoDoCampo } from "@/lib/metas";
import { cents } from "@/lib/money";
import { dataDeHoje } from "@/lib/dates";
import { lancamentoSchema, metaSchema, pontosSchema, projetoSchema, recebimentoSchema, volumeSchema } from "@/lib/validators";

/**
 * Os erros achados ao usar o sistema como um membro novo (DEVLOG, Marco 57).
 * Cada teste trava a correção de um deles.
 */

const recebimento = {
  projectId: "p",
  accountId: "a",
  receivedAt: "2026-10-21",
  tokenSymbol: "LIT",
  modo: "token",
  tokenAmount: "400",
  priceUsd: "1,25",
  valueUsd: "",
};

describe("recebimento aceita vírgula, como a prévia do campo mostra", () => {
  it("preço e quantidade com vírgula", () => {
    const r = recebimentoSchema.parse({ ...recebimento, tokenAmount: "1,5", priceUsd: "1,25" });
    expect(r).toMatchObject({ tokenAmount: "1.5", priceUsd: "1.25" });
  });

  it("preço de token com muitas casas não é arredondado a centavos", () => {
    expect(recebimentoSchema.parse({ ...recebimento, priceUsd: "0,000123" }).priceUsd).toBe("0.000123");
  });

  it("total em dólar no formato brasileiro", () => {
    const r = recebimentoSchema.parse({ ...recebimento, modo: "total", valueUsd: "1.250,50" });
    expect(r.valueUsd).toBe("1250.50");
  });

  it("continua recusando o que não é número", () => {
    const r = recebimentoSchema.safeParse({ ...recebimento, priceUsd: "abc" });
    expect(r.error?.issues[0]?.path).toEqual(["priceUsd"]);
  });
});

describe("lançamento em token aceita vírgula na quantidade", () => {
  it("1,5 SOL", () => {
    const r = lancamentoSchema.parse({
      projectId: "p",
      accountId: "a",
      occurredAt: "2026-10-21",
      type: "deposit",
      amount: "150",
      tokenSymbol: "sol",
      tokenAmount: "1,5",
      description: "",
    });
    expect(r).toMatchObject({ tokenSymbol: "SOL", tokenAmount: "1.5" });
  });
});

describe("site do projeto sem https", () => {
  const projeto = { name: "Lighter", status: "ativo", category: "perps", priority: "2", pointsLabel: "", chain: "", expectedTgeDate: "", twitterUrl: "", discordUrl: "", docsUrl: "", tutorialUrl: "", notes: "" };

  it("ganha https:// sozinho", () => {
    const r = projetoSchema.safeParse({ ...projeto, websiteUrl: "lighter.xyz" });
    expect(r.success && r.data.websiteUrl).toBe("https://lighter.xyz");
  });

  it("endereço já completo fica como está", () => {
    const r = projetoSchema.safeParse({ ...projeto, websiteUrl: "http://exemplo.com/a" });
    expect(r.success && r.data.websiteUrl).toBe("http://exemplo.com/a");
  });

  it("javascript: e texto solto continuam recusados", () => {
    expect(projetoSchema.safeParse({ ...projeto, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(projetoSchema.safeParse({ ...projeto, websiteUrl: "lighter" }).success).toBe(false);
  });
});

describe("meta de pontos", () => {
  it("pontos é métrica válida", () => {
    const r = metaSchema.safeParse({ projectId: "p", accountId: null, title: "50k", metric: "points", target: "50.000", deadline: "" });
    expect(r.success).toBe(true);
  });

  it("só métrica em dólar aparece com $", () => {
    expect(formatarValorDaMeta("points", cents(5_000_000))).toBe("50.000");
    expect(formatarValorDaMeta("tx_count", cents(1200))).toBe("12");
    expect(formatarValorDaMeta("volume_usd", cents(5_000_000))).toBe("$50,000.00");
    expect(formatoDoCampo("points")).toBe("pontos");
    expect(formatoDoCampo("balance_usd")).toBe("dinheiro");
  });
});

describe("medição não pode ser no futuro", () => {
  const base = { projectId: "p", accountId: "a", note: "" };
  const amanha = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  it("pontos e volume de amanhã são recusados, com mensagem no campo da data", () => {
    const p = pontosSchema.safeParse({ ...base, points: "100", takenAt: amanha });
    expect(p.error?.issues[0]).toMatchObject({ path: ["takenAt"], message: "A data da medição não pode ser no futuro." });
    const v = volumeSchema.safeParse({ ...base, volume: "100", takenAt: amanha });
    expect(v.error?.issues[0]?.path).toEqual(["takenAt"]);
  });

  it("hoje e o passado continuam valendo", () => {
    expect(pontosSchema.safeParse({ ...base, points: "100", takenAt: dataDeHoje() }).success).toBe(true);
    expect(volumeSchema.safeParse({ ...base, volume: "100", takenAt: "2026-01-10" }).success).toBe(true);
  });
});
