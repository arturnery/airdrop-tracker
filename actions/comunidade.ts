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
  { caminho: "/comunidade/calendario", tipo: "page" },
];

export async function criarLive(entrada: unknown): Promise<ResultadoAcao> {
  return executar(liveSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.insert(schema.lives).values({
      titulo: dados.titulo,
      apresentador: dados.apresentador,
      descricao: dados.descricao,
      link: dados.link,
      inicioEm: new Date(instanteDeBrasilia(dados.dia, dados.hora)),
      recorrencia: dados.recorrencia,
      repetirAte: dados.repetirAte,
      destaque: dados.destaque,
      criadoPor: userId,
    });
  }, ROTAS);
}

export async function atualizarLive(id: string, entrada: unknown): Promise<ResultadoAcao> {
  /*
   * O id fica fora do schema da live, que termina num refine e não aceita
   * `.extend`: é conferido aqui, e um id que não seja uuid nem chega ao banco.
   */
  if (!z.uuid().safeParse(id).success) {
    return { ok: false, erros: { geral: "Live inválida." } };
  }
  return executar(liveSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db
      .update(schema.lives)
      .set({
        titulo: dados.titulo,
        apresentador: dados.apresentador,
        descricao: dados.descricao,
        link: dados.link,
        inicioEm: new Date(instanteDeBrasilia(dados.dia, dados.hora)),
        recorrencia: dados.recorrencia,
        repetirAte: dados.repetirAte,
        destaque: dados.destaque,
      })
      .where(eq(schema.lives.id, id));
  }, ROTAS);
}

export async function excluirLive(id: string): Promise<ResultadoAcao> {
  return executar(z.object({ id: z.uuid("Live inválida.") }), { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.delete(schema.lives).where(eq(schema.lives.id, dados.id));
  }, ROTAS);
}
