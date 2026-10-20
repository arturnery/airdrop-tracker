import "server-only";

import { desc, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import type { Sinal } from "@/lib/sinais";

/**
 * Sinais publicados, do mais recente ao mais antigo. Conteúdo da área de
 * trade, igual para todos e fora do Dataset pessoal de airdrops: as áreas não
 * se misturam.
 */
export async function listarSinais(): Promise<Sinal[]> {
  const linhas = await db
    .select({
      id: schema.sinaisTrade.id,
      ativo: schema.sinaisTrade.ativo,
      direcao: schema.sinaisTrade.direcao,
      entrada: schema.sinaisTrade.entrada,
      entradaAte: schema.sinaisTrade.entradaAte,
      stop: schema.sinaisTrade.stop,
      // Como texto, não como `numeric[]`: o driver converte lista de numeric
      // para número de ponto flutuante, e um alvo de 0,00000123 voltaria
      // arredondado. Escalar sozinho volta texto; lista não.
      alvos: sql<string[]>`${schema.sinaisTrade.alvos}::text[]`,
      timeframe: schema.sinaisTrade.timeframe,
      observacao: schema.sinaisTrade.observacao,
      status: schema.sinaisTrade.status,
      publicadoEm: schema.sinaisTrade.publicadoEm,
    })
    .from(schema.sinaisTrade)
    .orderBy(desc(schema.sinaisTrade.publicadoEm))
    .limit(200);

  return linhas.map((l) => ({ ...l, publicadoEm: l.publicadoEm.toISOString() }));
}
