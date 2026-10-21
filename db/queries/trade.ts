import "server-only";

import { and, count, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import type { Sinal } from "@/lib/sinais";

/**
 * Sinais publicados, do mais recente ao mais antigo. Conteúdo da área de
 * trade, igual para todos e fora do Dataset pessoal de airdrops: as áreas não
 * se misturam.
 *
 * Abertos vão para a página de sinais e fechados (inclusive os não
 * acionados) para a de resultados. O filtro é no banco, e não na página:
 * com o limite de linhas, filtrar depois deixaria sinais abertos de fora
 * quando houvesse muitos fechados mais novos.
 */
export async function listarSinais(quais: "abertos" | "fechados"): Promise<Sinal[]> {
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
      saida: schema.sinaisTrade.saida,
      precoSaida: schema.sinaisTrade.precoSaida,
      encerradoEm: schema.sinaisTrade.encerradoEm,
    })
    .from(schema.sinaisTrade)
    .where(
      quais === "abertos"
        ? eq(schema.sinaisTrade.status, "aberto")
        : ne(schema.sinaisTrade.status, "aberto"),
    )
    .orderBy(desc(quais === "abertos" ? schema.sinaisTrade.publicadoEm : schema.sinaisTrade.encerradoEm))
    .limit(200);

  return linhas.map(({ discordEnviadoEm, ...l }) => ({
    ...l,
    publicadoEm: l.publicadoEm.toISOString(),
    encerradoEm: l.encerradoEm?.toISOString() ?? null,
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

/**
 * Junta às operações o que depende de quem está vendo: com quanto ela
 * entrou em cada uma, e quantas pessoas entraram. O valor das outras
 * pessoas não sai daqui, só a contagem.
 */
export async function comEntradas(sinais: Sinal[], userId: string): Promise<Sinal[]> {
  if (sinais.length === 0) return sinais;
  const ids = sinais.map((s) => s.id);
  const [minhas, contagens] = await Promise.all([
    db
      .select({ sinalId: schema.entradasTrade.sinalId, valor: schema.entradasTrade.valorUsd })
      .from(schema.entradasTrade)
      .where(and(eq(schema.entradasTrade.userId, userId), inArray(schema.entradasTrade.sinalId, ids))),
    db
      .select({ sinalId: schema.entradasTrade.sinalId, total: count() })
      .from(schema.entradasTrade)
      .where(inArray(schema.entradasTrade.sinalId, ids))
      .groupBy(schema.entradasTrade.sinalId),
  ]);
  const minha = new Map(minhas.map((m) => [m.sinalId, m.valor]));
  const total = new Map(contagens.map((c) => [c.sinalId, c.total]));
  return sinais.map((s) => ({
    ...s,
    minhaEntradaUsd: minha.get(s.id) ?? null,
    participantes: total.get(s.id) ?? 0,
  }));
}
