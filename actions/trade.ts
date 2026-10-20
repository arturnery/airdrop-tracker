"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { sinalSchema } from "@/lib/validators";

import { exigirAdministrador } from "./index";
import { executar, type ResultadoAcao } from "./_core";

/**
 * Escrita dos sinais de trade. Por enquanto só quem administra publica; a
 * permissão própria do professor entra depois, e é aqui que ela vai morar
 * (no lugar de `exigirAdministrador`), não no botão da tela.
 */

const ROTAS: { caminho: string; tipo: "page" | "layout" }[] = [
  { caminho: "/trade/sinais", tipo: "page" },
];

export async function publicarSinal(entrada: unknown): Promise<ResultadoAcao> {
  return executar(sinalSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.insert(schema.sinaisTrade).values({
      ativo: dados.ativo,
      direcao: dados.direcao,
      entrada: dados.entrada,
      entradaAte: dados.entradaAte,
      stop: dados.stop,
      alvos: dados.alvos,
      timeframe: dados.timeframe,
      observacao: dados.observacao,
      publicadoPor: userId,
    });
  }, ROTAS);
}

export async function excluirSinal(id: string): Promise<ResultadoAcao> {
  return executar(z.object({ id: z.uuid("Sinal inválido.") }), { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db.delete(schema.sinaisTrade).where(eq(schema.sinaisTrade.id, dados.id));
  }, ROTAS);
}
