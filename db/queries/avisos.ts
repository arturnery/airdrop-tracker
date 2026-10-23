import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

export type AreaDoAviso = (typeof schema.areaAvisoEnum.enumValues)[number];

export type Aviso = {
  id: string;
  titulo: string;
  resumo: string;
  acao: string | null;
  /** aaaa-mm-dd */
  prazo: string | null;
  link: string | null;
  projeto: string | null;
  perfilX: string | null;
  chamadaX: string | null;
  /** ISO 8601 */
  publicadoEm: string;
};

/** Os avisos de uma área, do mais recente ao mais antigo. Iguais para todos. */
export async function listarAvisos(area: AreaDoAviso): Promise<Aviso[]> {
  const linhas = await db
    .select({
      id: schema.avisos.id,
      titulo: schema.avisos.titulo,
      resumo: schema.avisos.resumo,
      acao: schema.avisos.acao,
      prazo: schema.avisos.prazo,
      link: schema.avisos.link,
      projeto: schema.avisos.projeto,
      perfilX: schema.avisos.perfilX,
      chamadaX: schema.avisos.chamadaX,
      publicadoEm: schema.avisos.publicadoEm,
    })
    .from(schema.avisos)
    .where(eq(schema.avisos.area, area))
    .orderBy(desc(schema.avisos.publicadoEm))
    .limit(100);
  return linhas.map((l) => ({ ...l, publicadoEm: l.publicadoEm.toISOString() }));
}
