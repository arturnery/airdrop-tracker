import { z } from "zod";

/*
 * Sem prazo, uma API lenta prende a requisição até a Vercel derrubá-la, e a
 * pessoa fica olhando um botão girando sem mensagem nenhuma.
 *
 * O plano gratuito do Gemini, medido, não tem tempo de resposta: a mesma
 * chamada levou de 2 a 58 segundos, e cada modelo entra e sai de "alta
 * demanda" (503) por conta própria. Num mesmo minuto, quatro de sete
 * modelos estavam travados ou sobrecarregados e um respondia em 6 segundos.
 * Por isso os modelos configurados são consultados **ao mesmo tempo** e vale
 * a primeira resposta que servir. Esperar um travado para só então tentar o
 * outro gastava o prazo inteiro no modelo errado.
 *
 * Se todos estiverem sobrecarregados, uma segunda rodada depois de uma pausa
 * curta, só com os que falharam por motivo passageiro.
 */
const PRAZO_TOTAL_MS = 45_000;
const PAUSA_ENTRE_RODADAS_MS = 2_000;

export type Motivo = "prazo" | "sobrecarga" | "resposta" | "erro";

export const MENSAGEM_DE_FALHA: Record<Motivo, string> = {
  prazo: "A IA não respondeu a tempo. Tente de novo em instantes.",
  sobrecarga:
    "A IA gratuita do Google está sobrecarregada agora. Tente de novo em alguns minutos, ou use o Novo lançamento.",
  resposta: "Não consegui entender a resposta da IA. Tente reescrever a frase.",
  erro: "Não foi possível falar com a IA agora. Tente de novo.",
};

/**
 * Por que uma tentativa falhou, porque cada motivo pede uma reação diferente.
 * `passageira` (rede, 5xx, o 503 de alta demanda) merece outra rodada.
 * `definitiva` (chave recusada, cota de 429, modelo que não existe mais) daria
 * o mesmo erro de novo, e cada tentativa conta na cota. `resposta` é o modelo
 * que respondeu, mas com algo que não dá para usar.
 */
class FalhaDaIA extends Error {
  constructor(
    readonly tipo: "passageira" | "definitiva" | "resposta",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/**
 * Mensagens no formato de chat da OpenAI. O conteúdo é texto ou, para ler
 * imagem, uma lista de partes (texto e `image_url` com data URL).
 */
export type Parte =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export type Mensagens = { role: "system" | "user"; content: string | Parte[] }[];

/**
 * Um modelo num provedor. Cada um com endereço e chave próprios, porque o
 * ganho de verdade está em misturar **provedores**: dois modelos do mesmo
 * provedor caíram juntos no mesmo pico de demanda.
 */
export type Alvo = { modelo: string; baseUrl: string; chave: string };

export type Pedido<T> = {
  mensagens: Mensagens;
  /**
   * Confere o JSON devolvido pelo modelo e devolve o que se aproveita, ou
   * `null`. Quem pergunta decide o que é uma resposta utilizável: lançamento
   * e sinal de trade têm conferências diferentes, a disputa é a mesma.
   */
  interpretar: (json: unknown) => T | null;
  /** Consultados ao mesmo tempo. Os repetidos contam uma vez só. */
  alvos: Alvo[];
  prazoMs?: number;
  pausaMs?: number;
  /** Trocável nos testes, que simulam cada modelo sem rede. */
  buscar?: typeof fetch;
};

export async function perguntar<T>({
  mensagens,
  interpretar,
  alvos: configurados,
  prazoMs = PRAZO_TOTAL_MS,
  pausaMs = PAUSA_ENTRE_RODADAS_MS,
  buscar = fetch,
}: Pedido<T>): Promise<{ ok: true; resultado: T } | { ok: false; motivo: Motivo }> {
  const total = AbortSignal.timeout(prazoMs);
  let alvos = configurados.filter(
    (a, i) =>
      configurados.findIndex((b) => b.modelo === a.modelo && b.baseUrl === a.baseUrl) === i,
  );
  let ultimas: FalhaDaIA[] = [];
  const todas: FalhaDaIA[] = [];

  for (let rodada = 1; rodada <= 2 && alvos.length > 0; rodada++) {
    if (rodada > 1) await pausa(pausaMs, total);
    if (total.aborted) break;

    // Quem perde a corrida é cancelado: não há por que esperar a resposta.
    const cancelar = new AbortController();
    const sinal = AbortSignal.any([total, cancelar.signal]);
    try {
      const resultado = await Promise.any(
        alvos.map((alvo) => perguntarAoModelo(alvo, buscar, mensagens, interpretar, sinal)),
      );
      return { ok: true, resultado };
    } catch (agregado) {
      ultimas = (agregado as AggregateError).errors.map((e) =>
        e instanceof FalhaDaIA ? e : new FalhaDaIA("passageira", String(e)),
      );
      todas.push(...ultimas);
      ultimas.forEach((falha, i) =>
        console.warn(`[ia] ${alvos[i]!.modelo} (rodada ${rodada}) ${falha.tipo}: ${falha.message}`),
      );
      alvos = alvos.filter((_, i) => ultimas[i]!.tipo === "passageira");
    } finally {
      cancelar.abort();
    }
  }

  if (total.aborted) return { ok: false, motivo: "prazo" };
  if (ultimas.length > 0 && ultimas.every((f) => f.tipo === "passageira")) {
    return { ok: false, motivo: "sobrecarga" };
  }
  if (todas.some((f) => f.tipo === "resposta")) return { ok: false, motivo: "resposta" };
  return { ok: false, motivo: "erro" };
}

function pausa(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    const relogio = setTimeout(resolver, ms);
    sinal.addEventListener("abort", () => {
      clearTimeout(relogio);
      resolver();
    }, { once: true });
  });
}

/**
 * Uma tentativa num modelo. Só resolve com uma resposta **utilizável**: um
 * modelo que devolve texto solto em vez de JSON não pode vencer a corrida e
 * deixar a resposta boa do outro ser cancelada.
 */
async function perguntarAoModelo<T>(
  { modelo, baseUrl, chave }: Alvo,
  buscar: typeof fetch,
  mensagens: Mensagens,
  interpretar: (json: unknown) => T | null,
  sinal: AbortSignal,
): Promise<T> {
  let resposta: Response;
  try {
    resposta = await buscar(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify({
        model: modelo,
        messages: mensagens,
        response_format: { type: "json_object" },
        temperature: 0,
        // Folgado de propósito: em modelos que raciocinam antes de responder
        // (Gemini, por exemplo), o raciocínio conta neste teto, e um teto
        // justo para o JSON cortaria a resposta antes de ela começar.
        max_tokens: 2000,
      }),
      signal: sinal,
    });
  } catch (erro) {
    throw new FalhaDaIA("passageira", `sem resposta: ${String(erro)}`);
  }

  if (!resposta.ok) {
    const corpo = (await resposta.text().catch(() => "")).slice(0, 300);
    const tipo = resposta.status >= 500 ? "passageira" : "definitiva";
    throw new FalhaDaIA(tipo, `status ${resposta.status}: ${corpo}`);
  }

  const dados: unknown = await resposta.json().catch(() => null);
  const envelope = z
    .object({
      choices: z
        .array(z.object({ message: z.object({ content: z.string() }) }))
        .min(1),
    })
    .safeParse(dados);
  if (!envelope.success) {
    throw new FalhaDaIA("resposta", `formato inesperado: ${JSON.stringify(dados).slice(0, 300)}`);
  }

  const conteudo = envelope.data.choices[0]!.message.content;
  let json: unknown;
  try {
    json = JSON.parse(conteudo);
  } catch {
    throw new FalhaDaIA("resposta", `não é JSON: ${conteudo.slice(0, 300)}`);
  }

  const resultado = interpretar(json);
  if (resultado === null) {
    throw new FalhaDaIA("resposta", `fora do formato: ${conteudo.slice(0, 300)}`);
  }
  return resultado;
}
