import "server-only";

import { asc, sql } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import type { Alvo, Desfecho } from "@/lib/perguntar-ia";

/**
 * Registra o desfecho de uma tentativa num modelo (ver `iaSaude` no schema).
 *
 * Nunca derruba nem atrasa o pedido de IA: é registro, não parte da resposta,
 * e grava depois que a resposta sai. Uma falha
 * aqui só vai para o log. O detalhe é cortado e nunca leva a chave (o erro
 * vem do corpo da resposta do provedor, não do pedido).
 */
export function registrarTentativa(alvo: Alvo, desfecho: Desfecho): void {
  const agora = new Date();
  const gravar = desfecho.ok
    ? db
        .insert(schema.iaSaude)
        .values({ modelo: alvo.modelo, ultimoOk: agora, falhasSeguidas: 0 })
        .onConflictDoUpdate({ target: schema.iaSaude.modelo, set: { ultimoOk: agora, falhasSeguidas: 0 } })
    : db
        .insert(schema.iaSaude)
        .values({
          modelo: alvo.modelo,
          ultimaFalha: agora,
          tipoFalha: desfecho.tipo,
          detalheFalha: desfecho.detalhe.slice(0, 300),
          falhasSeguidas: 1,
        })
        .onConflictDoUpdate({
          target: schema.iaSaude.modelo,
          set: {
            ultimaFalha: agora,
            tipoFalha: desfecho.tipo,
            detalheFalha: desfecho.detalhe.slice(0, 300),
            falhasSeguidas: sql`${schema.iaSaude.falhasSeguidas} + 1`,
          },
        });
  // `after`: na Vercel, uma escrita solta pode ser cortada quando a resposta
  // termina; assim ela roda depois da resposta, sem atrasar quem pediu.
  after(() => gravar.then(() => undefined, (erro: unknown) => console.warn("[ia-saude]", String(erro))));
}

export type SaudeDoModelo = {
  modelo: string;
  ultimoOk: string | null;
  ultimaFalha: string | null;
  tipoFalha: string | null;
  detalheFalha: string | null;
  falhasSeguidas: number;
};

export async function listarSaude(): Promise<SaudeDoModelo[]> {
  const linhas = await db.select().from(schema.iaSaude).orderBy(asc(schema.iaSaude.modelo));
  return linhas.map((l) => ({
    ...l,
    ultimoOk: l.ultimoOk?.toISOString() ?? null,
    ultimaFalha: l.ultimaFalha?.toISOString() ?? null,
  }));
}
