"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { instanteDeBrasilia } from "@/lib/lives";
import { liveSchema } from "@/lib/validators";

import { exigirAdministrador } from "./index";
import { executar, type ResultadoAcao } from "./_core";

/**
 * Escrita do conteúdo da comunidade. Toda ação começa por
 * `exigirAdministrador`: esconder o botão na tela não impede a requisição
 * direta, e é aqui que a regra vale.
 */

const ROTAS: { caminho: string; tipo: "page" | "layout" }[] = [
  { caminho: "/comunidade", tipo: "page" },
  // A Visão geral mostra a próxima live.
  { caminho: "/", tipo: "page" },
];

export async function criarLive(entrada: unknown): Promise<ResultadoAcao> {
  return executar(liveSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.insert(schema.lives).values({
      titulo: dados.titulo,
      descricao: dados.descricao,
      link: dados.link,
      inicioEm: new Date(instanteDeBrasilia(dados.dia, dados.hora)),
      semanal: dados.semanal,
      criadoPor: userId,
    });
  }, ROTAS);
}

export async function atualizarLive(id: string, entrada: unknown): Promise<ResultadoAcao> {
  const comId = liveSchema.extend({ id: z.uuid("Live inválida.") });
  return executar(comId, { ...(entrada as object), id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db
      .update(schema.lives)
      .set({
        titulo: dados.titulo,
        descricao: dados.descricao,
        link: dados.link,
        inicioEm: new Date(instanteDeBrasilia(dados.dia, dados.hora)),
        semanal: dados.semanal,
      })
      .where(eq(schema.lives.id, dados.id));
  }, ROTAS);
}

export async function excluirLive(id: string): Promise<ResultadoAcao> {
  return executar(z.object({ id: z.uuid("Live inválida.") }), { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.delete(schema.lives).where(eq(schema.lives.id, dados.id));
  }, ROTAS);
}
