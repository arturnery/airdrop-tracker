"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { reservarUsoDaIA } from "@/db/queries/uso-ia";
import { getCurrentUserId } from "@/lib/auth";
import { env } from "@/lib/env";
import { interpretarSinal, montarMensagensSinal, type SugestaoSinal } from "@/lib/interpretar-sinal";
import { precoDaSaida, type Sinal } from "@/lib/sinais";
import { montarMensagemDiscord } from "@/lib/sinais-discord";
import { perguntar, type Alvo, type Motivo } from "@/lib/perguntar-ia";
import { erros, fecharSinalSchema, sinalSchema } from "@/lib/validators";

import { exigirAdministrador } from "./index";
import { executar, falha, sucesso, type ResultadoAcao } from "./_core";

/**
 * Escrita dos sinais de trade. Por enquanto só quem administra publica; a
 * permissão própria do professor entra depois, e é aqui que ela vai morar
 * (no lugar de `exigirAdministrador`), não no botão da tela.
 */

const ROTAS: { caminho: string; tipo: "page" | "layout" }[] = [
  { caminho: "/trade/sinais", tipo: "page" },
  { caminho: "/trade/resultados", tipo: "page" },
];

export async function publicarSinal(entrada: unknown): Promise<ResultadoAcao> {
  return executar(sinalSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    const [criado] = await db.insert(schema.sinaisTrade).values({
      ativo: dados.ativo,
      direcao: dados.direcao,
      entrada: dados.entrada,
      entradaAte: dados.entradaAte,
      stop: dados.stop,
      alvos: dados.alvos,
      timeframe: dados.timeframe,
      observacao: dados.observacao,
      publicadoPor: userId,
    }).returning({ id: schema.sinaisTrade.id, publicadoEm: schema.sinaisTrade.publicadoEm });

    /*
     * O aviso no Discord não desfaz a publicação se falhar: o sinal já está
     * no site, que é a fonte. Mas a falha fica registrada (sem
     * `discordEnviadoEm`) e aparece no card para quem publica, com o botão
     * de reenviar, em vez de ser presumido que saiu.
     */
    if (criado) {
      await avisarNoDiscord({
        id: criado.id,
        ...dados,
        status: "aberto",
        publicadoEm: criado.publicadoEm.toISOString(),
        discordEnviado: false,
      });
    }
  }, ROTAS);
}

/**
 * Reenvia ao Discord um sinal cujo aviso não saiu. Não passa por `executar`
 * porque a falha aqui não é de banco: a mensagem precisa dizer que foi o
 * Discord, e o que conferir.
 */
export async function reenviarSinalDiscord(id: string): Promise<ResultadoAcao> {
  if (!z.uuid().safeParse(id).success) return falha("geral", "Sinal inválido.");
  if (!env.DISCORD_WEBHOOK_SINAIS) {
    return falha("geral", "O Discord não está configurado neste servidor (DISCORD_WEBHOOK_SINAIS).");
  }
  const userId = await getCurrentUserId();
  try {
    await exigirAdministrador(userId);
  } catch {
    return falha("geral", "Só quem publica sinais pode reenviar.");
  }

  const [linha] = await db
    .select({
      id: schema.sinaisTrade.id,
      ativo: schema.sinaisTrade.ativo,
      direcao: schema.sinaisTrade.direcao,
      entrada: schema.sinaisTrade.entrada,
      entradaAte: schema.sinaisTrade.entradaAte,
      stop: schema.sinaisTrade.stop,
      alvos: sql<string[]>`${schema.sinaisTrade.alvos}::text[]`,
      timeframe: schema.sinaisTrade.timeframe,
      observacao: schema.sinaisTrade.observacao,
      status: schema.sinaisTrade.status,
      publicadoEm: schema.sinaisTrade.publicadoEm,
    })
    .from(schema.sinaisTrade)
    .where(eq(schema.sinaisTrade.id, id))
    .limit(1);
  if (!linha) return falha("geral", "Esse sinal não existe mais.");

  const enviado = await avisarNoDiscord({
    ...linha,
    publicadoEm: linha.publicadoEm.toISOString(),
    discordEnviado: false,
  });
  if (!enviado) {
    return falha(
      "geral",
      "O Discord não confirmou o envio. Confira se o webhook do canal ainda existe e tente de novo.",
    );
  }
  for (const rota of ROTAS) revalidatePath(rota.caminho, rota.tipo);
  return sucesso();
}

/**
 * Manda o sinal ao canal e, se o Discord confirmar, grava `discordEnviadoEm`.
 * Devolve se saiu. `?wait=true` faz o Discord só responder depois de publicar
 * a mensagem, então um 200 aqui é confirmação de verdade, não "recebido".
 */
async function avisarNoDiscord(sinal: Sinal): Promise<boolean> {
  const webhook = env.DISCORD_WEBHOOK_SINAIS;
  if (!webhook) return false;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  try {
    const resposta = await fetch(`${webhook}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(montarMensagemDiscord(sinal, host ? `https://${host}` : null)),
      signal: AbortSignal.timeout(8_000),
    });
    if (!resposta.ok) {
      console.error("[discord] status", resposta.status, (await resposta.text().catch(() => "")).slice(0, 300));
      return false;
    }
    await db
      .update(schema.sinaisTrade)
      .set({ discordEnviadoEm: new Date() })
      .where(eq(schema.sinaisTrade.id, sinal.id));
    return true;
  } catch (erro) {
    console.error("[discord]", erro);
    return false;
  }
}

/**
 * Fecha um sinal aberto: grava por onde saiu e a que preço, e ele passa da
 * lista de sinais para a de resultados. O preço de alvo e de stop vem do
 * sinal gravado, nunca da tela, para o resultado não poder ser escolhido.
 *
 * O `where` exige o sinal ainda aberto, e não só a leitura de antes: dois
 * cliques (ou duas abas) não fecham o mesmo sinal duas vezes com preços
 * diferentes. O segundo recebe a mensagem de que ele já foi fechado.
 */
export async function fecharSinal(entrada: unknown): Promise<ResultadoAcao> {
  const analisado = fecharSinalSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };
  const { id, fechamento, precoManual } = analisado.data;

  const userId = await getCurrentUserId();
  try {
    await exigirAdministrador(userId);
  } catch {
    return falha("geral", "Só quem publica sinais pode fechá-los.");
  }

  const [sinal] = await db
    .select({
      status: schema.sinaisTrade.status,
      stop: schema.sinaisTrade.stop,
      alvos: sql<string[]>`${schema.sinaisTrade.alvos}::text[]`,
    })
    .from(schema.sinaisTrade)
    .where(eq(schema.sinaisTrade.id, id))
    .limit(1);
  if (!sinal) return falha("geral", "Esse sinal não existe mais.");
  if (sinal.status !== "aberto") return falha("geral", "Esse sinal já foi fechado.");

  let valores: Partial<typeof schema.sinaisTrade.$inferInsert>;
  if (fechamento === "cancelado") {
    valores = { status: "cancelado", saida: null, precoSaida: null };
  } else {
    const preco = precoDaSaida(sinal, fechamento, precoManual);
    if (!preco) return falha("fechamento", "Esse alvo não existe neste sinal.");
    valores = { status: "encerrado", saida: fechamento, precoSaida: preco };
  }

  const fechados = await db
    .update(schema.sinaisTrade)
    .set({ ...valores, encerradoEm: new Date() })
    .where(and(eq(schema.sinaisTrade.id, id), eq(schema.sinaisTrade.status, "aberto")))
    .returning({ id: schema.sinaisTrade.id });
  if (fechados.length === 0) return falha("geral", "Esse sinal já foi fechado.");

  for (const rota of ROTAS) revalidatePath(rota.caminho, rota.tipo);
  return sucesso();
}

/**
 * Desfaz um fechamento feito por engano: o sinal volta a aberto, e a saída
 * é apagada com `null` explícito em cada campo (no `update`, um campo
 * ausente seria preservado, e o sinal reaberto carregaria o resultado velho).
 */
export async function reabrirSinal(id: string): Promise<ResultadoAcao> {
  return executar(z.object({ id: z.uuid("Sinal inválido.") }), { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db
      .update(schema.sinaisTrade)
      .set({ status: "aberto", saida: null, precoSaida: null, encerradoEm: null })
      .where(eq(schema.sinaisTrade.id, dados.id));
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

// ------------------------------------------------------------------ sininho

/**
 * Marca os sinais como vistos, ao abrir a página de sinais: zera o sininho do
 * menu. O instante vem do servidor, nunca do navegador.
 */
export async function marcarSinaisVistos(): Promise<void> {
  const userId = await getCurrentUserId();
  await db
    .update(schema.users)
    .set({ sinaisVistosEm: new Date() })
    .where(eq(schema.users.id, userId));
  revalidatePath("/", "layout");
}
