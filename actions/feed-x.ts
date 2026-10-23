"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { CHAVE_LISTA_X } from "@/db/queries/feed-x";
import { linkDaListaX } from "@/lib/feed-x";

import { exigirAdministrador } from "./index";
import { ErroDeRegra, executar, type ResultadoAcao } from "./_core";

const listaSchema = z.object({ url: z.string().trim().max(300) });

/** Grava (ou apaga, com texto vazio) o link da Lista do X do feed. Só admin. */
export async function salvarListaDoX(url: string): Promise<ResultadoAcao> {
  return executar(listaSchema, { url }, async (dados, userId) => {
    await exigirAdministrador(userId);
    if (dados.url === "") {
      await db.delete(schema.configuracoes).where(eq(schema.configuracoes.chave, CHAVE_LISTA_X));
      return;
    }
    const link = linkDaListaX(dados.url);
    if (!link) throw new ErroDeRegra("url", "Cole o link de uma Lista do X (x.com/i/lists/...).");
    await db
      .insert(schema.configuracoes)
      .values({ chave: CHAVE_LISTA_X, valor: link, atualizadoPor: userId })
      .onConflictDoUpdate({ target: schema.configuracoes.chave, set: { valor: link, atualizadoEm: new Date(), atualizadoPor: userId } });
  }, [{ caminho: "/feed-x", tipo: "page" }]);
}
