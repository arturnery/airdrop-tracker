"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { reservarUsoDaIA } from "@/db/queries/uso-ia";
import { registrarTentativa } from "@/db/queries/saude-ia";
import { alvosDa } from "@/lib/alvos-ia";
import { montarMensagemAvisoDiscord, type AvisoParaDiscord } from "@/lib/avisos-discord";
import { env } from "@/lib/env";
import { getCurrentUserId } from "@/lib/auth";
import { dataDeHoje } from "@/lib/dates";
import { interpretarAviso, MAX_ANUNCIO, montarMensagensAviso, type SugestaoAviso } from "@/lib/interpretar-aviso";
import { perguntar, type Motivo } from "@/lib/perguntar-ia";
import { avisoSchema } from "@/lib/validators";

import { exigirAdministrador } from "./index";
import { ErroDeRegra, executar, falha, sucesso, type ResultadoAcao } from "./_core";

/**
 * Avisos para a comunidade. Só quem administra publica; todos leem no mural
 * da área (hoje, só o de Airdrops).
 */

const ROTAS: { caminho: string; tipo: "page" | "layout" }[] = [{ caminho: "/avisos", tipo: "page" }];

export async function publicarAviso(entrada: unknown): Promise<ResultadoAcao> {
  return executar(avisoSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    const [criado] = await db
      .insert(schema.avisos)
      .values({ ...dados, area: "airdrops", publicadoPor: userId })
      .returning({ id: schema.avisos.id, publicadoEm: schema.avisos.publicadoEm });

    /*
     * O Discord não desfaz a publicação se falhar: o aviso já está no mural,
     * que é a fonte. A falha fica registrada (sem `discordEnviadoEm`) e
     * aparece no card para quem administra, com o botão de reenviar, em vez
     * de ser presumido que saiu. Editar depois não reenvia.
     */
    if (criado) await avisarNoDiscord(criado.id, { ...dados, publicadoEm: criado.publicadoEm.toISOString() });
  }, ROTAS);
}

/**
 * Reenvia ao Discord um aviso que não saiu. Não passa por `executar` porque a
 * falha aqui não é de banco: a mensagem precisa dizer que foi o Discord.
 */
export async function reenviarAvisoDiscord(id: string): Promise<ResultadoAcao> {
  if (!z.uuid().safeParse(id).success) return falha("geral", "Aviso inválido.");
  if (!env.DISCORD_WEBHOOK_AVISOS) {
    return falha("geral", "O Discord não está configurado neste servidor (DISCORD_WEBHOOK_AVISOS).");
  }
  try {
    await exigirAdministrador(await getCurrentUserId());
  } catch {
    return falha("geral", "Só quem administra pode reenviar avisos.");
  }

  const [aviso] = await db.select().from(schema.avisos).where(eq(schema.avisos.id, id)).limit(1);
  if (!aviso) return falha("geral", "Esse aviso não existe mais.");

  const enviado = await avisarNoDiscord(aviso.id, { ...aviso, publicadoEm: aviso.publicadoEm.toISOString() });
  if (!enviado) {
    return falha("geral", "O Discord não confirmou o envio. Confira se o webhook do canal ainda existe e tente de novo.");
  }
  for (const rota of ROTAS) revalidatePath(rota.caminho, rota.tipo);
  return sucesso();
}

/**
 * Manda o aviso ao canal e, se o Discord confirmar, grava `discordEnviadoEm`.
 * `?wait=true` faz o Discord só responder depois de publicar a mensagem,
 * então um 200 aqui é confirmação de verdade, não "recebido".
 */
async function avisarNoDiscord(id: string, aviso: AvisoParaDiscord): Promise<boolean> {
  const webhook = env.DISCORD_WEBHOOK_AVISOS;
  if (!webhook) return false;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  try {
    const resposta = await fetch(`${webhook}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(montarMensagemAvisoDiscord(aviso, host ? `https://${host}` : null)),
      signal: AbortSignal.timeout(8_000),
    });
    if (!resposta.ok) {
      console.error("[discord avisos] status", resposta.status, (await resposta.text().catch(() => "")).slice(0, 300));
      return false;
    }
    await db.update(schema.avisos).set({ discordEnviadoEm: new Date() }).where(eq(schema.avisos.id, id));
    return true;
  } catch (erro) {
    console.error("[discord avisos]", erro);
    return false;
  }
}

/**
 * Edita um aviso publicado. Cada campo é regravado inteiro (o formulário
 * manda todos), então um campo esvaziado vira `null` de verdade, e não fica
 * com o valor antigo.
 */
export async function atualizarAviso(id: string, entrada: unknown): Promise<ResultadoAcao> {
  return executar(avisoSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    if (!z.uuid().safeParse(id).success) throw new ErroDeRegra("geral", "Aviso inválido.");
    const alterados = await db
      .update(schema.avisos)
      .set({ ...dados, atualizadoEm: new Date() })
      .where(eq(schema.avisos.id, id))
      .returning({ id: schema.avisos.id });
    if (alterados.length === 0) throw new ErroDeRegra("geral", "Esse aviso não existe mais.");
  }, ROTAS);
}

export async function excluirAviso(id: string): Promise<ResultadoAcao> {
  return executar(z.object({ id: z.uuid("Aviso inválido.") }), { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.delete(schema.avisos).where(eq(schema.avisos.id, dados.id));
  }, ROTAS);
}

const MENSAGEM: Record<Motivo, string> = {
  prazo: "A IA não respondeu a tempo. Tente de novo em instantes.",
  sobrecarga: "A IA gratuita está sobrecarregada agora. Tente de novo em alguns minutos, ou escreva o aviso à mão.",
  resposta: "Não consegui montar um aviso a partir desse texto. Confira se ele é o anúncio do projeto.",
  erro: "Não foi possível falar com a IA agora. Tente de novo.",
};

export type ResultadoAnuncio = { ok: true; sugestao: SugestaoAviso } | { ok: false; erro: string };

/**
 * Lê o anúncio colado e devolve os campos do aviso para conferência. Não
 * publica nada. Usa a IA da tarefa "aviso" (`lib/alvos-ia`), que é só texto:
 * o Gemini fica reservado aos prints de operação.
 */
export async function interpretarAnuncio(anuncio: unknown): Promise<ResultadoAnuncio> {
  const valido = z
    .string()
    .trim()
    .min(40, "Cole o texto do anúncio (o post ou a página do projeto).")
    .max(MAX_ANUNCIO, `O texto passou de ${MAX_ANUNCIO} caracteres. Cole só a parte do anúncio.`)
    .safeParse(anuncio);
  if (!valido.success) return { ok: false, erro: valido.error.issues[0]?.message ?? "Texto inválido." };

  const alvos = alvosDa("aviso");
  if (alvos.length === 0) return { ok: false, erro: "A IA dos avisos ainda não foi configurada neste servidor." };

  const userId = await getCurrentUserId();
  try {
    await exigirAdministrador(userId);
  } catch {
    return { ok: false, erro: "Só quem publica avisos pode usar a IA para montá-los." };
  }

  try {
    const recusa = await reservarUsoDaIA(userId);
    if (recusa) {
      return {
        ok: false,
        erro:
          recusa === "pessoa"
            ? "Você atingiu o limite de uso da IA nas últimas 24 horas. O aviso pode ser escrito à mão."
            : "A IA atingiu o limite de uso do dia. O aviso pode ser escrito à mão.",
      };
    }
    const desfecho = await perguntar({
      mensagens: montarMensagensAviso(valido.data, dataDeHoje()),
      interpretar: (json) => interpretarAviso(json, valido.data),
      alvos,
      maxTokens: 8000,
      aoTentar: registrarTentativa,
    });
    return desfecho.ok ? { ok: true, sugestao: desfecho.resultado } : { ok: false, erro: MENSAGEM[desfecho.motivo] };
  } catch (erro) {
    console.error("[ia-aviso]", erro);
    return { ok: false, erro: MENSAGEM.erro };
  }
}
