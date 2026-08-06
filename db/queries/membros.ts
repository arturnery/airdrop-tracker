import "server-only";

import { asc, ne } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { daysBetween } from "@/lib/dates";
import type { MemberRow } from "@/lib/types";

/**
 * Solicitações de acesso.
 *
 * Só o administrador deve chamar — a lista traz e-mails de todo mundo. A
 * verificação de papel é responsabilidade da rota que consome (§9.4); esta
 * função não a faz para não esconder onde a decisão acontece.
 *
 * A ordem é por quem espera há mais tempo: numa fila de aprovação o mais antigo
 * é o mais urgente, e é justamente ele que some do topo se a ordenação for
 * decrescente.
 */
export async function listarMembros(hoje: string): Promise<MemberRow[]> {
  const linhas = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      reviewedAt: schema.users.reviewedAt,
      reviewNote: schema.users.reviewNote,
    })
    .from(schema.users)
    // O próprio admin não aparece na fila que ele administra.
    .where(ne(schema.users.role, "admin"))
    .orderBy(asc(schema.users.createdAt));

  return linhas.map((u) => {
    const cadastradoEm = u.createdAt.toISOString().slice(0, 10);
    return {
      id: u.id,
      nome: u.name,
      email: u.email,
      status: u.status,
      cadastradoEm,
      revisadoEm: u.reviewedAt ? u.reviewedAt.toISOString().slice(0, 10) : null,
      nota: u.reviewNote,
      diasEsperando: Math.abs(daysBetween(hoje, cadastradoEm)),
    };
  });
}
