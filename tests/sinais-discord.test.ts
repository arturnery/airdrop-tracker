import { describe, expect, it } from "vitest";

import type { Sinal } from "@/lib/sinais";
import { montarMensagemDiscord } from "@/lib/sinais-discord";

const sinal: Sinal = {
  id: "s1",
  ativo: "BTC/USDT",
  direcao: "compra",
  entrada: "64200",
  entradaAte: null,
  stop: "63450",
  alvos: ["65800", "67350"],
  timeframe: "4h",
  observacao: null,
  status: "aberto",
  publicadoEm: "2026-10-19T23:02:00.000Z",
  discordEnviado: false,
};

describe("montarMensagemDiscord", () => {
  it("monta título, campos e alvos com risco/retorno", () => {
    const m = montarMensagemDiscord(sinal, "https://lvl-airdrop.vercel.app");
    expect(m.content).toBe("Nova operação: COMPRA BTC/USDT");
    expect(m.embeds[0]!.title).toBe("COMPRA (long) BTC/USDT");
    expect(m.embeds[0]!.url).toBe("https://lvl-airdrop.vercel.app/trade/operacoes");
    expect(m.embeds[0]!.fields).toEqual([
      { name: "Entrada", value: "64,200", inline: true },
      { name: "Stop", value: "63,450", inline: true },
      { name: "Timeframe", value: "4h", inline: true },
      { name: "Alvos", value: "TP1: 65,800 (1:2.1)\nTP2: 67,350 (1:4.2)", inline: false },
    ]);
  });

  /*
   * A observação é texto livre: um "@everyone" nela notificaria o servidor
   * inteiro. As menções vão desligadas em toda mensagem.
   */
  it("desliga as menções, para @everyone na observação não notificar ninguém", () => {
    const m = montarMensagemDiscord({ ...sinal, observacao: "@everyone entrem agora" }, null);
    expect(m.allowed_mentions).toEqual({ parse: [] });
    expect(m.embeds[0]!.description).toBe("@everyone entrem agora");
  });

  it("venda com zona de entrada, sem site configurado", () => {
    const m = montarMensagemDiscord(
      { ...sinal, direcao: "venda", entrada: "3420", entradaAte: "3450", stop: "3498", alvos: ["3355"], timeframe: null },
      null,
    );
    expect(m.embeds[0]!.title).toBe("VENDA (short) BTC/USDT");
    expect(m.embeds[0]!.url).toBeUndefined();
    expect(m.embeds[0]!.fields[0]).toEqual({ name: "Zona de entrada", value: "3,420 a 3,450", inline: true });
    expect(m.embeds[0]!.fields.map((f) => f.name)).toEqual(["Zona de entrada", "Stop", "Alvos"]);
  });
});
