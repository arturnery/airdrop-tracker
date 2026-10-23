"use server";

import { registrarTentativa } from "@/db/queries/saude-ia";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { dataDeHoje } from "@/lib/dates";
import { alvosDa } from "@/lib/alvos-ia";
import { env } from "@/lib/env";
import {
  interpretarResposta,
  montarMensagens,
  type ContextoIA,
  type Sugestao,
} from "@/lib/interpretar-lancamento";
import { MENSAGEM_DE_FALHA, perguntar } from "@/lib/perguntar-ia";
import { LIMITE_POR_PESSOA, reservarUsoDaIA } from "@/db/queries/uso-ia";

/**
 * Interpreta uma frase como lançamento. Ver `lib/interpretar-lancamento.ts`.
 *
 * Não grava nada no razão: devolve a sugestão para a tela preencher o
 * formulário, e o salvar continua sendo `criarLancamento`.
 */

const entradaSchema = z
  .string()
  .trim()
  .min(3, "Escreva o lançamento em uma frase.")
  .max(500, "Seja mais breve: até 500 caracteres.");

export type ResultadoIA =
  | { ok: true; sugestoes: Sugestao[] }
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
    const ctx = { ...(await carregarContexto(userId)), frase: texto.data };
    if (ctx.projetos.length === 0 || ctx.contas.length === 0) {
      return {
        ok: false,
        erro: "Cadastre ao menos um projeto e uma conta antes: a IA só escolhe entre os seus.",
      };
    }

    const recusa = await reservarUsoDaIA(userId);
    if (recusa === "pessoa") {
      return {
        ok: false,
        erro: `Você já usou a IA ${LIMITE_POR_PESSOA} vezes nas últimas 24 horas. O lançamento manual continua disponível.`,
      };
    }
    if (recusa === "total") {
      return {
        ok: false,
        erro: "A IA atingiu o limite de uso do dia. O lançamento manual continua disponível.",
      };
    }

    const desfecho = await perguntar({
      mensagens: montarMensagens(texto.data, ctx),
      interpretar: (json) => interpretarResposta(json, ctx),
      alvos: alvosDa("lancamento"),
      aoTentar: registrarTentativa,
    });
    if (desfecho.ok) {
      /*
       * O formulário de pontos não abre para quem não tem nenhum projeto com
       * programa de pontos (não haveria o que escolher no select), e a fila
       * da tela travaria esperando ele fechar. Melhor dizer agora o porquê.
       */
      const semPrograma =
        desfecho.resultado.some((s) => s.formulario === "pontos") &&
        !ctx.projetos.some((p) => p.pontos);
      if (semPrograma) {
        return {
          ok: false,
          erro: "Nenhum projeto seu tem programa de pontos cadastrado. Edite o projeto, informe o nome dos pontos e tente de novo.",
        };
      }
      return { ok: true, sugestoes: desfecho.resultado };
    }
    return { ok: false, erro: MENSAGEM_DE_FALHA[desfecho.motivo] };
  } catch (erro) {
    console.error("[ia]", erro);
    return { ok: false, erro: "Não foi possível falar com a IA agora. Tente de novo." };
  }
}


async function carregarContexto(userId: string): Promise<ContextoIA> {
  const [projetos, contas, vinculos, pontos, volumes] = await Promise.all([
    db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        pontos: schema.projects.pointsLabel,
      })
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
    db
      .select({
        projectId: schema.pointsSnapshots.projectId,
        accountId: schema.pointsSnapshots.accountId,
        valor: schema.pointsSnapshots.points,
        data: schema.pointsSnapshots.takenAt,
      })
      .from(schema.pointsSnapshots)
      .where(eq(schema.pointsSnapshots.userId, userId)),
    db
      .select({
        projectId: schema.volumeSnapshots.projectId,
        accountId: schema.volumeSnapshots.accountId,
        valor: schema.volumeSnapshots.volumeUsd,
        data: schema.volumeSnapshots.takenAt,
      })
      .from(schema.volumeSnapshots)
      .where(eq(schema.volumeSnapshots.userId, userId)),
  ]);

  return {
    hoje: dataDeHoje(),
    projetos,
    contas,
    vinculos,
    medicoes: [
      ...ultimaDeCadaPar("pontos", pontos),
      ...ultimaDeCadaPar("volume", volumes),
    ],
  };
}

/**
 * Só a medição mais recente de cada par projeto e conta: é a base sobre a
 * qual "ganhei 200 pontos" vira o total que o formulário pede.
 */
function ultimaDeCadaPar(
  tipo: "pontos" | "volume",
  linhas: { projectId: string; accountId: string; valor: string; data: string }[],
): NonNullable<ContextoIA["medicoes"]> {
  const ultimas = new Map<string, (typeof linhas)[number]>();
  for (const linha of linhas) {
    const chave = `${linha.projectId}:${linha.accountId}`;
    const atual = ultimas.get(chave);
    if (!atual || linha.data > atual.data) ultimas.set(chave, linha);
  }
  return [...ultimas.values()].map((l) => ({ ...l, tipo, valor: Number(l.valor) }));
}
