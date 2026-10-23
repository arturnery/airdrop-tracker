import "server-only";

import { eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const CHAVE_LISTA_X = "lista_x";

/** O link da Lista do X configurado por quem administra, ou null. */
export async function lerListaDoX(): Promise<string | null> {
  const [linha] = await db
    .select({ valor: schema.configuracoes.valor })
    .from(schema.configuracoes)
    .where(eq(schema.configuracoes.chave, CHAVE_LISTA_X))
    .limit(1);
  return linha?.valor ?? null;
}

/** Os destaques publicados, com o endereço do X e o status, para o feed. */
export async function destaquesDoFeed() {
  return db
    .select({ nome: schema.catalogProjects.name, twitterUrl: schema.catalogProjects.twitterUrl, status: schema.catalogProjects.status })
    .from(schema.catalogProjects)
    .where(isNotNull(schema.catalogProjects.publishedAt));
}
