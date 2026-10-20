import "server-only";

import { count, desc, gt, sql } from "drizzle-orm";

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
      discordEnviadoEm: schema.sinaisTrade.discordEnviadoEm,
    })
    .from(schema.sinaisTrade)
    .orderBy(desc(schema.sinaisTrade.publicadoEm))
    .limit(200);

  return linhas.map(({ discordEnviadoEm, ...l }) => ({
    ...l,
    publicadoEm: l.publicadoEm.toISOString(),
    discordEnviado: discordEnviadoEm !== null,
  }));
}

/**
 * Quantos sinais saíram desde que a pessoa abriu a página pela última vez: é
 * o número do sininho no menu. Quem nunca abriu conta só a última semana,
 * para uma conta nova não estrear com o histórico inteiro "não lido".
 */
export async function contarSinaisNovos(vistosEm: Date | null): Promise<number> {
  const desde = vistosEm ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [linha] = await db
    .select({ total: count() })
    .from(schema.sinaisTrade)
    .where(gt(schema.sinaisTrade.publicadoEm, desde));
  return linha?.total ?? 0;
}
