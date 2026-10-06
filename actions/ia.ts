"use server";

import { eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { dataDeHoje } from "@/lib/dates";
import { env } from "@/lib/env";
import {
  interpretarResposta,
  montarMensagens,
  type ContextoIA,
  type SugestaoLancamento,
} from "@/lib/interpretar-lancamento";

/**
 * Interpreta uma frase como lançamento. Ver `lib/interpretar-lancamento.ts`.
 *
 * Não grava nada no razão: devolve a sugestão para a tela preencher o
 * formulário, e o salvar continua sendo `criarLancamento`.
 */

/*
 * Dois tetos, e não um. O por pessoa impede que alguém use a chave como
 * se fosse dele; o total protege a conta do provedor quando várias pessoas
 * (ou várias contas criadas para isso) ficam abaixo do limite individual ao
 * mesmo tempo. A conta de demonstração é pública, então os dois importam.
 */
const LIMITE_POR_PESSOA = 30;
const LIMITE_TOTAL = 300;

/*
 * Sem prazo, uma API lenta prende a requisição até a Vercel derrubá-la, e a
 * pessoa fica olhando um botão girando sem mensagem nenhuma. 30 segundos
 * porque o plano gratuito do Gemini, medido, responde entre 12 e 16.
 */
const PRAZO_MS = 30_000;

const entradaSchema = z
  .string()
  .trim()
  .min(3, "Escreva o lançamento em uma frase.")
  .max(500, "Seja mais breve: até 500 caracteres.");

export type ResultadoIA =
  | { ok: true; sugestao: SugestaoLancamento }
  | { ok: false; erro: string };

export async function interpretarLancamento(entrada: unknown): Promise<ResultadoIA> {
  const texto = entradaSchema.safeParse(entrada);
  if (!texto.success) {
    return { ok: false, erro: texto.error.issues[0]?.message ?? "Texto inválido." };
  }

  if (!env.IA_API_KEY) {
    return { ok: false, erro: "A IA ainda não foi configurada neste servidor." };
  }

  const userId = await getCurrentUserId();

  try {
    const [{ daPessoa, total } = { daPessoa: 0, total: 0 }] = await db
      .select({
        daPessoa: sql<number>`count(*) filter (where ${schema.iaUsos.userId} = ${userId})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.iaUsos)
      .where(gte(schema.iaUsos.criadoEm, sql`now() - interval '24 hours'`));

    if (daPessoa >= LIMITE_POR_PESSOA) {
      return {
        ok: false,
        erro: `Você já usou a IA ${LIMITE_POR_PESSOA} vezes nas últimas 24 horas. O lançamento manual continua disponível.`,
      };
    }
    if (total >= LIMITE_TOTAL) {
      return {
        ok: false,
        erro: "A IA atingiu o limite de uso do dia. O lançamento manual continua disponível.",
      };
    }

    const ctx = await carregarContexto(userId);
    if (ctx.projetos.length === 0 || ctx.contas.length === 0) {
      return {
        ok: false,
        erro: "Cadastre ao menos um projeto e uma conta antes: a IA só escolhe entre os seus.",
      };
    }

    // Conta antes de chamar: pedido que falha também custa, e não contar
    // deixaria um erro em laço gastar sem limite.
    await db.insert(schema.iaUsos).values({ userId });

    const conteudo = await chamarModelo(montarMensagens(texto.data, ctx));
    if (conteudo === null) {
      return { ok: false, erro: "A IA não respondeu a tempo. Tente de novo em instantes." };
    }

    let json: unknown;
    try {
      json = JSON.parse(conteudo);
    } catch {
      console.error("[ia] resposta não é JSON:", conteudo.slice(0, 300));
      return { ok: false, erro: "Não consegui entender a resposta da IA. Tente reescrever a frase." };
    }

    const sugestao = interpretarResposta(json, ctx);
    if (!sugestao) {
      console.error("[ia] resposta fora do formato:", conteudo.slice(0, 300));
      return { ok: false, erro: "Não consegui entender a resposta da IA. Tente reescrever a frase." };
    }
    return { ok: true, sugestao };
  } catch (erro) {
    console.error("[ia]", erro);
    return { ok: false, erro: "Não foi possível falar com a IA agora. Tente de novo." };
  }
}

async function carregarContexto(userId: string): Promise<ContextoIA> {
  const [projetos, contas, vinculos] = await Promise.all([
    db
      .select({ id: schema.projects.id, name: schema.projects.name })
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId)),
    db
      .select({ id: schema.accounts.id, label: schema.accounts.label })
      .from(schema.accounts)
      // Todas, como o select do formulário: a IA só pode escolher o que a
      // tela também conseguiria mostrar.
      .where(eq(schema.accounts.userId, userId)),
    db
      .select({
        projectId: schema.projectAccounts.projectId,
        accountId: schema.projectAccounts.accountId,
      })
      .from(schema.projectAccounts)
      .innerJoin(schema.projects, eq(schema.projects.id, schema.projectAccounts.projectId))
      .where(eq(schema.projects.userId, userId)),
  ]);

  return { hoje: dataDeHoje(), projetos, contas, vinculos };
}

/**
 * Devolve o texto da resposta, ou `null` quando estourou o prazo.
 * Qualquer outra falha (chave inválida, cota, formato) sobe como erro e é
 * logada inteira por quem chamou, porque cada uma pede uma correção diferente
 * do lado de quem administra.
 *
 * Uma segunda tentativa só para o que é passageiro: rede que caiu no meio e
 * o "alta demanda" (503) que o plano gratuito do Gemini devolve em picos.
 * Cota esgotada (429) e chave recusada não se repetem: dariam o mesmo erro, e
 * cada tentativa conta na cota. O prazo é um só para as duas, então a pessoa
 * nunca espera mais que `PRAZO_MS`.
 */
const STATUS_PASSAGEIRO = new Set([500, 502, 503, 504]);

async function chamarModelo(
  mensagens: { role: string; content: string }[],
): Promise<string | null> {
  const prazo = AbortSignal.timeout(PRAZO_MS);
  let resposta: Response | null = null;

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const ultima = tentativa === 2;
    try {
      resposta = await fetch(`${env.IA_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.IA_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.IA_MODELO,
          messages: mensagens,
          response_format: { type: "json_object" },
          temperature: 0,
          // Folgado de propósito: em modelos que raciocinam antes de responder
          // (Gemini, por exemplo), o raciocínio conta neste teto, e um teto
          // justo para o JSON cortaria a resposta antes de ela começar.
          max_tokens: 2000,
        }),
        signal: prazo,
      });
    } catch (erro) {
      if (prazo.aborted) return null;
      if (ultima) throw erro;
      console.warn("[ia] falha de rede, tentando de novo:", erro);
      continue;
    }

    if (resposta.ok || ultima || !STATUS_PASSAGEIRO.has(resposta.status)) break;
    console.warn(`[ia] status ${resposta.status}, tentando de novo`);
    await resposta.body?.cancel();
  }

  if (!resposta!.ok) {
    const corpo = await resposta!.text().catch(() => "");
    throw new Error(`IA respondeu ${resposta!.status}: ${corpo.slice(0, 300)}`);
  }

  const dados: unknown = await resposta!.json();
  const conteudo = z
    .object({
      choices: z
        .array(z.object({ message: z.object({ content: z.string() }) }))
        .min(1),
    })
    .safeParse(dados);
  if (!conteudo.success) {
    throw new Error(`IA devolveu formato inesperado: ${JSON.stringify(dados).slice(0, 300)}`);
  }
  return conteudo.data.choices[0]!.message.content;
}
