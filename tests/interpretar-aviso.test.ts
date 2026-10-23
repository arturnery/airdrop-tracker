import { describe, expect, it } from "vitest";

import { LIMITE_DO_X, linkParaResponder, postAnuncioDoAviso, postRespostaDaComunidade, tamanhoNoX } from "@/lib/compartilhar-x";
import { idDoPostX, interpretarAviso } from "@/lib/interpretar-aviso";
import { avisoSchema } from "@/lib/validators";

const ANUNCIO = `The Extend airdrop is live! Eligible users can claim $EXT until November 15, 2026.
Check eligibility at https://claim.extend.example/airdrop
Follow @ExtendFi for updates. https://x.com/ExtendFi/status/1888000000000000001`;

const resposta = {
  titulo: "Extend libera o airdrop do token EXT",
  resumo: "O airdrop da Extend começou. Quem é elegível pode resgatar o token EXT.",
  acao: "Consulte a elegibilidade no site\nFaça o claim",
  prazo: "2026-11-15",
  link: "https://claim.extend.example/airdrop",
  projeto: "Extend",
  perfil_x: "ExtendFi",
  chamada_x: null,
  destaques: ["Claim aberto para usuários elegíveis.", "Prazo até 15/11/2026", "  👉 Sem custo  "],
  ticker: "$EXT",
  alerta: "Cuidado com sites e DMs falsos!",
  post_oficial_x: null,
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

describe("campos novos do aviso", () => {
  it("ticker sem o $, tópicos limpos e o post oficial achado no texto colado", () => {
    const { valores } = interpretarAviso(resposta, ANUNCIO)!;
    expect(valores.ticker).toBe("EXT");
    expect(valores.destaques.split("\n")).toEqual(["Claim aberto para usuários elegíveis", "Prazo até 15/11/2026", "Sem custo"]);
    expect(valores.postOficialX).toBe("https://x.com/ExtendFi/status/1888000000000000001");
  });

  it("ticker e post oficial que não estão no anúncio são descartados", () => {
    const sem = ANUNCIO.replace(/ https:\/\/x\.com\S+/, "");
    const { valores } = interpretarAviso({ ...resposta, ticker: "XYZ", post_oficial_x: "https://x.com/Outro/status/123456789" }, sem)!;
    expect(valores.ticker).toBe("");
    expect(valores.postOficialX).toBe("");
  });

  it("idDoPostX lê x.com e twitter.com, e recusa o resto", () => {
    expect(idDoPostX("https://x.com/extendedapp/status/2113673873862582750?s=46")).toBe("2113673873862582750");
    expect(idDoPostX("https://twitter.com/a/status/123456")).toBe("123456");
    expect(idDoPostX("https://x.com/extendedapp")).toBeNull();
    expect(idDoPostX("https://example.com/a/status/123456")).toBeNull();
  });
});

describe("post do X em duas partes", () => {
  const base = {
    chamada: null,
    projeto: "Extended",
    destaques: ["30% do supply será distribuído para a comunidade", "Data prevista para o mês de NOV"],
    alerta: "Não terá página para claim: será dropado direto na sua wallet, então fiquem atentos a golpes",
    perfilProjeto: "extendedapp",
    postOficialX: "https://x.com/extendedapp/status/2113673873862582750",
    link: "https://extended.example/airdrop",
  };

  it("parte 1 no formato da comunidade, com o alerta como último tópico e o post oficial citado", () => {
    expect(postAnuncioDoAviso(base)).toBe(
      "Anúncio do airdrop da @extendedapp 🪂\n\n" +
        "-> 30% do supply será distribuído para a comunidade\n" +
        "-> Data prevista para o mês de NOV\n" +
        "-> Não terá página para claim: será dropado direto na sua wallet, então fiquem atentos a golpes\n\n" +
        "https://x.com/extendedapp/status/2113673873862582750",
    );
  });

  it("sem @ do projeto usa o nome; sem post oficial, leva o link do anúncio", () => {
    const post = postAnuncioDoAviso({ ...base, perfilProjeto: null, postOficialX: null });
    expect(post.startsWith("Anúncio do airdrop de Extended 🪂")).toBe(true);
    expect(post.endsWith("https://extended.example/airdrop")).toBe(true);
  });

  it("o título pode ser trocado no formulário", () => {
    expect(postAnuncioDoAviso({ ...base, chamada: "Saiu o airdrop da Extended" }).startsWith("Saiu o airdrop da Extended 🪂")).toBe(true);
  });

  it("tópicos demais saem para caber nos 280, e o alerta fica", () => {
    const longo = "x".repeat(110);
    const post = postAnuncioDoAviso({ ...base, destaques: [longo, longo, longo] });
    expect(tamanhoNoX(post)).toBeLessThanOrEqual(LIMITE_DO_X);
    expect(post).toContain("fiquem atentos a golpes");
    expect(post).toContain(base.postOficialX);
  });

  it("parte 2 é a divulgação, e abre como resposta ao anúncio", () => {
    const resposta = postRespostaDaComunidade();
    expect(tamanhoNoX(resposta)).toBeLessThanOrEqual(LIMITE_DO_X);
    expect(resposta).toContain("@LevelCripto");
    expect(resposta).toContain("https://www.levelcripto.com.br/");
    expect(linkParaResponder(resposta, "2113673873862582750")).toMatch(/&in_reply_to=2113673873862582750$/);
  });
});
