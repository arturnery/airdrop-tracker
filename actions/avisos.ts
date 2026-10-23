"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { reservarUsoDaIA } from "@/db/queries/uso-ia";
import { alvosDa } from "@/lib/alvos-ia";
import { getCurrentUserId } from "@/lib/auth";
import { dataDeHoje } from "@/lib/dates";
import { interpretarAviso, MAX_ANUNCIO, montarMensagensAviso, type SugestaoAviso } from "@/lib/interpretar-aviso";
import { perguntar, type Motivo } from "@/lib/perguntar-ia";
import { avisoSchema } from "@/lib/validators";

import { exigirAdministrador } from "./index";
import { executar, type ResultadoAcao } from "./_core";

/**
 * Avisos para a comunidade. Só quem administra publica; todos leem no mural
 * da área (hoje, só o de Airdrops).
 */

const ROTAS: { caminho: string; tipo: "page" | "layout" }[] = [{ caminho: "/avisos", tipo: "page" }];

export async function publicarAviso(entrada: unknown): Promise<ResultadoAcao> {
  return executar(avisoSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.insert(schema.avisos).values({ ...dados, area: "airdrops", publicadoPor: userId });
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
    });
    return desfecho.ok ? { ok: true, sugestao: desfecho.resultado } : { ok: false, erro: MENSAGEM[desfecho.motivo] };
  } catch (erro) {
    console.error("[ia-aviso]", erro);
    return { ok: false, erro: MENSAGEM.erro };
  }
}
