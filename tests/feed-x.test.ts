import { describe, expect, it } from "vitest";

import { arrobasParaCopiar, linkDaListaX, projetosDoFeed } from "@/lib/feed-x";

describe("linkDaListaX", () => {
  it("aceita x.com e twitter.com, com ou sem parâmetros, e devolve o link canônico", () => {
    expect(linkDaListaX("https://x.com/i/lists/1580546543542652928")).toBe("https://x.com/i/lists/1580546543542652928");
    expect(linkDaListaX("https://twitter.com/i/lists/1580546543542652928?s=20")).toBe("https://x.com/i/lists/1580546543542652928");
    expect(linkDaListaX(" https://mobile.x.com/i/lists/123456/members ")).toBe("https://x.com/i/lists/123456");
  });

  it("recusa perfil, post, outro site e texto solto", () => {
    expect(linkDaListaX("https://x.com/extendedapp")).toBeNull();
    expect(linkDaListaX("https://x.com/a/status/123456789")).toBeNull();
    expect(linkDaListaX("https://example.com/i/lists/123456")).toBeNull();
    expect(linkDaListaX("lista")).toBeNull();
    expect(linkDaListaX(null)).toBeNull();
  });
});

describe("projetosDoFeed", () => {
  const d = (nome: string, twitterUrl: string | null, status: "ativo" | "pausado" | "distribuido" | "descartado" | "pesquisando" = "ativo") => ({ nome, twitterUrl, status });

  it("tira distribuídos e descartados, e deixa os outros (inclusive pausados)", () => {
    const r = projetosDoFeed([
      d("Lighter", "https://x.com/lighter_xyz"),
      d("Velho", "https://x.com/velho", "distribuido"),
      d("Morto", "https://x.com/morto", "descartado"),
      d("Pausado", "https://x.com/pausado", "pausado"),
    ]);
    expect(r.map((p) => p.nome)).toEqual(["Lighter", "Pausado"]);
  });

  it("quem tem @ primeiro; endereço que não é perfil conta como sem @", () => {
    const r = projetosDoFeed([d("Zeta", "https://x.com/zeta"), d("Alfa", null), d("Beta", "https://x.com/search?q=beta"), d("Gama", "https://x.com/gama")]);
    expect(r.map((p) => [p.nome, p.perfil])).toEqual([
      ["Gama", "gama"],
      ["Zeta", "zeta"],
      ["Alfa", null],
      ["Beta", null],
    ]);
    expect(arrobasParaCopiar(r)).toBe("@gama\n@zeta");
  });
});
