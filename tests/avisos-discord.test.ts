import { describe, expect, it } from "vitest";

import { montarMensagemAvisoDiscord, type AvisoParaDiscord } from "@/lib/avisos-discord";

const base: AvisoParaDiscord = {
  titulo: "Extend anuncia airdrop",
  resumo: "30% do supply vai para a comunidade.",
  acao: "Conecte a wallet\nConfira a elegibilidade",
  prazo: "2026-11-30",
  link: "https://example.com/airdrop",
  projeto: "Extend",
  destaques: "30% do supply será distribuído\nData prevista para o mês de NOV",
  alerta: "Não terá página de claim",
  postOficialX: "https://x.com/extendapp/status/123456789",
  publicadoEm: "2026-11-18T12:00:00.000Z",
};

describe("montarMensagemAvisoDiscord", () => {
  it("monta título, resumo e os destaques com ->, com link para o mural", () => {
    const m = montarMensagemAvisoDiscord(base, "https://lvl.example.com");
    const e = m.embeds[0]!;
    expect(m.content).toBe("Novo aviso: Extend 🪂");
    expect(e.title).toBe("Extend anuncia airdrop");
    expect(e.url).toBe("https://lvl.example.com/avisos");
    expect(e.description).toBe(
      "30% do supply vai para a comunidade.\n\n-> 30% do supply será distribuído\n-> Data prevista para o mês de NOV",
    );
  });

  it("traz alerta, o que fazer, prazo em dd/mm/aaaa, link e post oficial", () => {
    const campos = Object.fromEntries(montarMensagemAvisoDiscord(base, null).embeds[0]!.fields.map((f) => [f.name, f.value]));
    expect(campos["⚠️ Atenção"]).toBe("Não terá página de claim");
    expect(campos["O que fazer"]).toBe("Conecte a wallet\nConfira a elegibilidade");
    expect(campos["Prazo"]).toBe("30/11/2026");
    expect(campos["Link oficial"]).toBe("https://example.com/airdrop");
    expect(campos["Post oficial no X"]).toBe("https://x.com/extendapp/status/123456789");
  });

  it("campo vazio não vira campo na mensagem, e sem site não há link", () => {
    const m = montarMensagemAvisoDiscord(
      { ...base, acao: null, prazo: null, link: null, alerta: null, postOficialX: null, destaques: null, projeto: null },
      null,
    );
    expect(m.embeds[0]!.fields).toEqual([]);
    expect(m.embeds[0]).not.toHaveProperty("url");
    expect(m.embeds[0]!.description).toBe("30% do supply vai para a comunidade.");
    expect(m.content).toBe("Novo aviso 🪂");
  });

  it("menções desligadas: um @everyone colado do anúncio não notifica o servidor", () => {
    const m = montarMensagemAvisoDiscord({ ...base, resumo: "@everyone corram" }, null);
    expect(m.allowed_mentions).toEqual({ parse: [] });
  });

  it("texto longo é cortado no limite do Discord em vez de a mensagem ser recusada", () => {
    const m = montarMensagemAvisoDiscord({ ...base, titulo: "a".repeat(300), resumo: "b".repeat(5000) }, null);
    expect(m.embeds[0]!.title.length).toBe(256);
    expect(m.embeds[0]!.description.length).toBe(4000);
    expect(m.embeds[0]!.description.endsWith("…")).toBe(true);
  });
});
