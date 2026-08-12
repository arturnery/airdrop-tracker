"use server";

import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { erros, feedbackSchema } from "@/lib/validators";

/**
 * Suporte e feedback. Ver ARCHITECTURE.md §14.
 *
 * Caixa de entrada, não sistema de tickets: a resposta sai por e-mail, que já
 * está no cadastro. Não há tabela de respostas nem estado de conversa.
 */

/** Teto diário por conta. A demonstração é pública e está no README. */
const LIMITE_DIARIO = 3;

export type ResultadoFeedback =
  | { ok: true; aviso: string }
  | { ok: false; erros: Record<string, string> };

export async function enviarFeedback(
  entrada: unknown,
): Promise<ResultadoFeedback> {
  const analisado = feedbackSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };

  try {
    const userId = await getCurrentUserId();

    /*
     * O limite existe porque a conta de demonstração é pública: sem ele, uma
     * pessoa mal-intencionada enche o banco em minutos e a caixa deixa de ser
     * utilizável, que é o mesmo raciocínio do pedido de senha.
     */
    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.feedback)
      .where(
        and(
          eq(schema.feedback.userId, userId),
          gte(schema.feedback.createdAt, sql`now() - interval '24 hours'`),
        ),
      );

    if (total >= LIMITE_DIARIO) {
      return {
        ok: false,
        erros: {
          geral:
            `Você já enviou ${LIMITE_DIARIO} relatos nas últimas 24 horas. ` +
            "Aguarde para enviar outro, ou responda o e-mail da conversa anterior.",
        },
      };
    }

    await db.insert(schema.feedback).values({
      userId,
      tipo: analisado.data.tipo,
      mensagem: analisado.data.mensagem,
      rota: analisado.data.rota,
      versao: analisado.data.versao,
    });

    revalidatePath("/", "layout");
    return {
      ok: true,
      aviso:
        "Recebido. A resposta vai para o e-mail do seu cadastro; não é automática, então pode levar um tempo.",
    };
  } catch (erro) {
    console.error("[feedback]", erro);
    return { ok: false, erros: { geral: "Não foi possível enviar. Tente de novo." } };
  }
}

/** Marca como lido ou resolvido. Restrito a quem administra. */
export async function marcarFeedback(
  id: string,
  estado: "lido" | "resolvido",
): Promise<{ ok: boolean }> {
  try {
    const userId = await getCurrentUserId();

    const [quem] = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (quem?.role !== "admin") return { ok: false };

    /*
     * Resolver implica lido: marcar só o resolvido deixaria o contador de não
     * lidos aceso para algo já tratado.
     */
    await db
      .update(schema.feedback)
      .set(
        estado === "resolvido"
          ? { lidoEm: sql`coalesce(lido_em, now())`, resolvidoEm: sql`now()` }
          : { lidoEm: sql`now()` },
      )
      .where(eq(schema.feedback.id, id));

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (erro) {
    console.error("[feedback:marcar]", erro);
    return { ok: false };
  }
}

/** Quantos relatos ainda não foram abertos. Alimenta o contador do menu. */
export async function contarNaoLidos(): Promise<number> {
  const [linha] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.feedback)
    .where(isNull(schema.feedback.lidoEm));

  return linha?.total ?? 0;
}
