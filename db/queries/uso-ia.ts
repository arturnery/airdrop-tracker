import "server-only";

import { gte, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

/*
 * Dois tetos, e não um. O por pessoa impede que alguém use a chave como
 * se fosse dele; o total protege a conta do provedor quando várias pessoas
 * (ou várias contas criadas para isso) ficam abaixo do limite individual ao
 * mesmo tempo. A conta de demonstração é pública, então os dois importam.
 *
 * Valem para todo uso da IA (lançamento por frase e leitura de print de
 * sinal): é a mesma chave pagando.
 */
export const LIMITE_POR_PESSOA = 30;
export const LIMITE_TOTAL = 300;

/**
 * Confere os limites e, se couber, já registra o uso. Devolve o motivo da
 * recusa, ou `null` quando pode seguir.
 *
 * Conta antes de chamar o modelo: pedido que falha também custa, e não contar
 * deixaria um erro em laço gastar sem limite.
 */
export async function reservarUsoDaIA(userId: string): Promise<"pessoa" | "total" | null> {
  const [{ daPessoa, total } = { daPessoa: 0, total: 0 }] = await db
    .select({
      daPessoa: sql<number>`count(*) filter (where ${schema.iaUsos.userId} = ${userId})::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.iaUsos)
    .where(gte(schema.iaUsos.criadoEm, sql`now() - interval '24 hours'`));

  if (daPessoa >= LIMITE_POR_PESSOA) return "pessoa";
  if (total >= LIMITE_TOTAL) return "total";
  await db.insert(schema.iaUsos).values({ userId });
  return null;
}
