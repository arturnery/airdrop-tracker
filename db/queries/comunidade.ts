import "server-only";

import { asc } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import type { Live } from "@/lib/lives";

/**
 * Lives cadastradas, de todos: é conteúdo da comunidade, sem filtro por
 * usuário. Ficam fora do Dataset pessoal, que é recarregado a cada navegação,
 * e são lidas só pelas telas que as mostram.
 */
export async function listarLives(): Promise<Live[]> {
  const linhas = await db
    .select({
      id: schema.lives.id,
      titulo: schema.lives.titulo,
      apresentador: schema.lives.apresentador,
      descricao: schema.lives.descricao,
      link: schema.lives.link,
      inicioEm: schema.lives.inicioEm,
      recorrencia: schema.lives.recorrencia,
      repetirAte: schema.lives.repetirAte,
      destaque: schema.lives.destaque,
    })
    .from(schema.lives)
    .orderBy(asc(schema.lives.inicioEm));

  return linhas.map((l) => ({ ...l, inicioEm: l.inicioEm.toISOString() }));
}
