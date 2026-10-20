"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { reservarUsoDaIA } from "@/db/queries/uso-ia";
import { getCurrentUserId } from "@/lib/auth";
import { env } from "@/lib/env";
import { interpretarSinal, montarMensagensSinal, type SugestaoSinal } from "@/lib/interpretar-sinal";
import { perguntar, type Alvo, type Motivo } from "@/lib/perguntar-ia";
import { sinalSchema } from "@/lib/validators";

import { exigirAdministrador } from "./index";
import { executar, type ResultadoAcao } from "./_core";

/**
 * Escrita dos sinais de trade. Por enquanto só quem administra publica; a
 * permissão própria do professor entra depois, e é aqui que ela vai morar
 * (no lugar de `exigirAdministrador`), não no botão da tela.
 */

const ROTAS: { caminho: string; tipo: "page" | "layout" }[] = [
  { caminho: "/trade/sinais", tipo: "page" },
];

export async function publicarSinal(entrada: unknown): Promise<ResultadoAcao> {
  return executar(sinalSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.insert(schema.sinaisTrade).values({
      ativo: dados.ativo,
      direcao: dados.direcao,
      entrada: dados.entrada,
      entradaAte: dados.entradaAte,
      stop: dados.stop,
      alvos: dados.alvos,
      timeframe: dados.timeframe,
      observacao: dados.observacao,
      publicadoPor: userId,
    });
  }, ROTAS);
}

export async function excluirSinal(id: string): Promise<ResultadoAcao> {
  return executar(z.object({ id: z.uuid("Sinal inválido.") }), { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.delete(schema.sinaisTrade).where(eq(schema.sinaisTrade.id, dados.id));
  }, ROTAS);
}

// ------------------------------------------------------------ leitura do print

/*
 * O navegador reduz o print (até 1600 px, JPEG) antes de enviar, o que dá
 * entre 150 e 400 KB. O teto fica abaixo do limite de 1 MB das Server
 * Actions, que não foi aumentado: aumentar valeria para toda ação do site.
 */
const MAX_IMAGEM = 950_000;

const imagemSchema = z
  .string()
  .max(MAX_IMAGEM, "A imagem ficou grande demais, mesmo reduzida. Recorte o print e tente de novo.")
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Envie uma imagem PNG, JPG ou WebP.");

const MENSAGEM_DO_PRINT: Record<Motivo, string> = {
  prazo: "A IA não respondeu a tempo. Tente de novo em instantes.",
  sobrecarga:
    "A IA gratuita do Google está sobrecarregada agora. Tente de novo em alguns minutos, ou preencha o sinal à mão.",
  resposta:
    "Não consegui ler uma operação neste print. Confira se ele mostra a entrada, o stop e os alvos.",
  erro: "Não foi possível falar com a IA agora. Tente de novo.",
};

export type ResultadoPrint = { ok: true; sugestao: SugestaoSinal } | { ok: false; erro: string };

/**
 * Lê o print de uma operação e devolve os campos do sinal, para o
 * formulário abrir preenchido. Não publica nada nem guarda a imagem.
 *
 * Só os modelos do provedor principal (Gemini) entram: são os que leem
 * imagem. O segundo provedor (`IA2_*`) é só texto.
 */
export async function interpretarPrint(imagem: unknown): Promise<ResultadoPrint> {
  const valida = imagemSchema.safeParse(imagem);
  if (!valida.success) {
    return { ok: false, erro: valida.error.issues[0]?.message ?? "Imagem inválida." };
  }
  if (!env.IA_API_KEY) {
    return { ok: false, erro: "A IA ainda não foi configurada neste servidor." };
  }

  const userId = await getCurrentUserId();
  try {
    await exigirAdministrador(userId);
  } catch {
    return { ok: false, erro: "Só quem publica sinais pode usar a leitura de print." };
  }

  try {
    const recusa = await reservarUsoDaIA(userId);
    if (recusa) {
      return {
        ok: false,
        erro:
          recusa === "pessoa"
            ? "Você atingiu o limite de uso da IA nas últimas 24 horas. O sinal pode ser preenchido à mão."
            : "A IA atingiu o limite de uso do dia. O sinal pode ser preenchido à mão.",
      };
    }

    const principal = { baseUrl: env.IA_BASE_URL, chave: env.IA_API_KEY };
    const alvos: Alvo[] = [{ ...principal, modelo: env.IA_MODELO }];
    if (env.IA_MODELO_RESERVA) alvos.push({ ...principal, modelo: env.IA_MODELO_RESERVA });

    const desfecho = await perguntar({
      mensagens: montarMensagensSinal(valida.data),
      interpretar: interpretarSinal,
      alvos,
    });
    return desfecho.ok
      ? { ok: true, sugestao: desfecho.resultado }
      : { ok: false, erro: MENSAGEM_DO_PRINT[desfecho.motivo] };
  } catch (erro) {
    console.error("[ia-print]", erro);
    return { ok: false, erro: MENSAGEM_DO_PRINT.erro };
  }
}
