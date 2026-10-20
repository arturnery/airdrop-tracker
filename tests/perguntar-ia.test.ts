import { describe, expect, it } from "vitest";

import { interpretarResposta, type ContextoIA } from "@/lib/interpretar-lancamento";
import { perguntar } from "@/lib/perguntar-ia";

const ctx: ContextoIA = {
  hoje: "2026-10-13",
  projetos: [{ id: "l", name: "Lighter" }, { id: "v", name: "Variational" }],
  contas: [{ id: "c", label: "chrome" }],
  vinculos: [],
};

const BOA = JSON.stringify({
  lancamentos: [
    { projeto: "P1", conta: "C1", tipo: "withdrawal", valor: 70 },
    { projeto: "P2", conta: "C1", tipo: "deposit", valor: 70 },
  ],
});

type Comportamento =
  | { tipo: "responde"; conteudo: string; depoisDe?: number }
  | { tipo: "status"; status: number }
  | { tipo: "trava" }
  | { tipo: "rede" };

/**
 * `fetch` falso: cada modelo se comporta como mandado, e a lista de chamadas
 * fica guardada para conferir quantas vezes cada um foi consultado.
 */
function simular(porModelo: Record<string, Comportamento | Comportamento[]>) {
  const chamadas: string[] = [];
  const buscar = (async (_url: string, init: RequestInit) => {
    const modelo = JSON.parse(String(init.body)).model as string;
    const vez = chamadas.filter((m) => m === modelo).length;
    chamadas.push(modelo);
    const roteiro = porModelo[modelo]!;
    const c = Array.isArray(roteiro) ? roteiro[Math.min(vez, roteiro.length - 1)]! : roteiro;
    const sinal = init.signal!;

    const esperar = (ms: number) =>
      new Promise<void>((resolver, rejeitar) => {
        const t = setTimeout(resolver, ms);
        sinal.addEventListener("abort", () => {
          clearTimeout(t);
          rejeitar(new DOMException("abortado", "AbortError"));
        });
      });

    if (c.tipo === "rede") throw new TypeError("fetch failed");
    if (c.tipo === "trava") {
      await esperar(60_000);
      throw new Error("inalcançável");
    }
    if (c.tipo === "status") {
      return new Response(JSON.stringify({ error: { code: c.status } }), { status: c.status });
    }
    await esperar(c.depoisDe ?? 0);
    return new Response(JSON.stringify({ choices: [{ message: { content: c.conteudo } }] }));
  }) as unknown as typeof fetch;
  return { buscar, chamadas };
}

const alvo = (modelo: string, baseUrl = "https://ia.exemplo") => ({ modelo, baseUrl, chave: "x" });

const base = (buscar: typeof fetch, modelos: string[], prazoMs = 2_000) =>
  perguntar({
    mensagens: [],
    interpretar: (json) => interpretarResposta(json, ctx),
    alvos: modelos.map((m) => alvo(m)),
    prazoMs,
    pausaMs: 10,
    buscar,
  });

describe("perguntar", () => {
  /*
   * O caso real que motivou a corrida: o principal em "alta demanda" e o
   * reserva respondendo. Antes, o reserva só era tentado depois de 20 s.
   */
  it("um sobrecarregado e outro bom: vale o bom", async () => {
    const { buscar } = simular({
      a: { tipo: "status", status: 503 },
      b: { tipo: "responde", conteudo: BOA },
    });
    const r = await base(buscar, ["a", "b"]);
    expect(r.ok && r.resultado.map((s) => (s.formulario === "lancamento" ? s.type : null))).toEqual(["withdrawal", "deposit"]);
  });

  it("um travado não segura o outro: o rápido vence sem esperar o prazo", async () => {
    const { buscar } = simular({
      a: { tipo: "trava" },
      b: { tipo: "responde", conteudo: BOA, depoisDe: 20 },
    });
    const inicio = Date.now();
    const r = await base(buscar, ["a", "b"]);
    expect(r.ok).toBe(true);
    expect(Date.now() - inicio).toBeLessThan(500);
  });

  it("resposta inútil não vence a corrida contra uma boa que chega depois", async () => {
    const { buscar } = simular({
      a: { tipo: "responde", conteudo: "<thought>pensando…" },
      b: { tipo: "responde", conteudo: BOA, depoisDe: 30 },
    });
    const r = await base(buscar, ["a", "b"]);
    expect(r.ok).toBe(true);
  });

  it("os dois sobrecarregados: uma segunda rodada, e se ela der certo, vale", async () => {
    const { buscar, chamadas } = simular({
      a: [{ tipo: "status", status: 503 }, { tipo: "responde", conteudo: BOA }],
      b: { tipo: "status", status: 503 },
    });
    const r = await base(buscar, ["a", "b"]);
    expect(r.ok).toBe(true);
    expect(chamadas.filter((m) => m === "a")).toHaveLength(2);
  });

  it("sobrecarga nas duas rodadas vira a mensagem de sobrecarga, não a genérica", async () => {
    const { buscar, chamadas } = simular({
      a: { tipo: "status", status: 503 },
      b: { tipo: "rede" },
    });
    expect(await base(buscar, ["a", "b"])).toEqual({ ok: false, motivo: "sobrecarga" });
    expect(chamadas).toHaveLength(4);
  });

  it("erro definitivo não é repetido: cota e chave recusada dariam o mesmo erro", async () => {
    const { buscar, chamadas } = simular({
      a: { tipo: "status", status: 429 },
      b: { tipo: "status", status: 401 },
    });
    expect(await base(buscar, ["a", "b"])).toEqual({ ok: false, motivo: "erro" });
    expect(chamadas).toHaveLength(2);
  });

  it("só o passageiro volta na segunda rodada", async () => {
    const { buscar, chamadas } = simular({
      a: { tipo: "status", status: 404 },
      b: { tipo: "status", status: 503 },
    });
    await base(buscar, ["a", "b"]);
    expect(chamadas).toEqual(["a", "b", "b"]);
  });

  it("todos travados: desiste no prazo, com a mensagem de prazo", async () => {
    const { buscar } = simular({ a: { tipo: "trava" }, b: { tipo: "trava" } });
    const inicio = Date.now();
    expect(await base(buscar, ["a", "b"], 200)).toEqual({ ok: false, motivo: "prazo" });
    expect(Date.now() - inicio).toBeLessThan(1_000);
  });

  it("o modelo respondeu, mas nada se aproveita: pede para reescrever", async () => {
    const { buscar } = simular({ a: { tipo: "responde", conteudo: "texto solto" } });
    expect(await base(buscar, ["a"])).toEqual({ ok: false, motivo: "resposta" });
  });

  it("o mesmo modelo no mesmo provedor é consultado uma vez só", async () => {
    const { buscar, chamadas } = simular({ a: { tipo: "responde", conteudo: BOA } });
    await perguntar({
      mensagens: [],
      interpretar: (json) => interpretarResposta(json, ctx),
      alvos: [alvo("a"), alvo("a")],
      buscar,
    });
    expect(chamadas).toEqual(["a"]);
  });

  it("cada alvo vai para o próprio provedor, com a própria chave", async () => {
    const vistos: string[] = [];
    const buscar = (async (url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      vistos.push(`${url} ${auth}`);
      return new Response(JSON.stringify({ choices: [{ message: { content: BOA } }] }));
    }) as unknown as typeof fetch;
    await perguntar({
      mensagens: [],
      interpretar: (json) => interpretarResposta(json, ctx),
      alvos: [
        { modelo: "g", baseUrl: "https://google.exemplo/", chave: "chave-g" },
        { modelo: "o", baseUrl: "https://openrouter.exemplo", chave: "chave-o" },
      ],
      buscar,
    });
    expect(vistos.sort()).toEqual([
      "https://google.exemplo/chat/completions Bearer chave-g",
      "https://openrouter.exemplo/chat/completions Bearer chave-o",
    ]);
  });
});
