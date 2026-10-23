import { describe, expect, it } from "vitest";

import { LIMITE_DO_X, postDeAviso, tamanhoNoX } from "@/lib/compartilhar-x";
import { interpretarAviso } from "@/lib/interpretar-aviso";
import { avisoSchema } from "@/lib/validators";

const ANUNCIO = `The Extend airdrop is live! Eligible users can claim $EXT until November 15, 2026.
Check eligibility at https://claim.extend.example/airdrop
Follow @ExtendFi for updates.`;

const resposta = {
  titulo: "Extend libera o airdrop do token EXT",
  resumo: "O airdrop da Extend começou. Quem é elegível pode resgatar o token EXT.",
  acao: "Consulte a elegibilidade no site\nFaça o claim",
  prazo: "2026-11-15",
  link: "https://claim.extend.example/airdrop",
  projeto: "Extend",
  perfil_x: "ExtendFi",
  chamada_x: "Airdrop da Extend liberado: confira se você é elegível e faça o claim até 15/11.",
};

describe("interpretarAviso", () => {
  it("aproveita a resposta quando tudo está no anúncio", () => {
    const r = interpretarAviso(resposta, ANUNCIO)!;
    expect(r.valores).toMatchObject({ link: "https://claim.extend.example/airdrop", perfilX: "ExtendFi", prazo: "2026-11-15" });
  });

  it("link que não está no anúncio é descartado, com aviso", () => {
    const r = interpretarAviso({ ...resposta, link: "https://extend-claim.example/airdrop" }, ANUNCIO)!;
    expect(r.valores.link).toBe("");
    expect(r.avisos.join(" ")).toContain("não está no anúncio");
  });

  it("@ que não aparece no anúncio fica em branco", () => {
    expect(interpretarAviso({ ...resposta, perfil_x: "ExtendOfficial" }, ANUNCIO)!.valores.perfilX).toBe("");
  });

  it("prazo cujo dia não aparece no anúncio é descartado", () => {
    const r = interpretarAviso({ ...resposta, prazo: "2026-11-20" }, ANUNCIO)!;
    expect(r.valores.prazo).toBe("");
    expect(r.avisos.join(" ")).toContain("não deixa a data clara");
  });

  it("sem título nem resumo, não há aviso para abrir", () => {
    expect(interpretarAviso({ titulo: null, resumo: "" }, ANUNCIO)).toBeNull();
    expect(interpretarAviso("texto solto", ANUNCIO)).toBeNull();
  });

  it("o que a IA devolve passa na validação do formulário", () => {
    const { valores } = interpretarAviso(resposta, ANUNCIO)!;
    expect(avisoSchema.safeParse(valores).success).toBe(true);
  });
});

describe("postDeAviso", () => {
  it("marca o projeto, leva o link oficial e o convite", () => {
    const post = postDeAviso({ chamada: resposta.chamada_x, projeto: { nome: "Extend", perfil: "ExtendFi" }, link: resposta.link });
    expect(post.startsWith("📢 @ExtendFi: Airdrop da Extend liberado")).toBe(true);
    expect(post).toContain("https://claim.extend.example/airdrop");
    expect(post).toContain("Quer fazer parte? Entra aqui:");
  });

  it("chamada longa é cortada para caber, sem cortar link nem rodapé", () => {
    const post = postDeAviso({ chamada: "x".repeat(400), projeto: { nome: "Extend", perfil: "abcdefghijklmno" }, link: resposta.link });
    expect(tamanhoNoX(post)).toBeLessThanOrEqual(LIMITE_DO_X);
    expect(post).toContain("…");
    expect(post).toContain(resposta.link);
    expect(post).toContain("https://www.levelcripto.com.br/");
  });
});
