import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import type { IsoDate } from "@/lib/types";

/**
 * Relatos de suporte, para a área de administração. Ver ARCHITECTURE.md §14.
 *
 * Traz o e-mail de quem enviou porque é por ele que a resposta sai: a tela
 * monta um `mailto:` já preenchido, e ter o endereço aqui evita uma segunda
 * consulta só para descobrir para quem escrever.
 *
 * Como toda consulta que expõe dados de terceiros, quem chama é responsável por
 * exigir papel de administrador (§9.4).
 */
export type FeedbackRow = {
  id: string;
  tipo: "bug" | "duvida" | "sugestao";
  mensagem: string;
  rota: string | null;
  versao: string | null;
  criadoEm: IsoDate;
  lido: boolean;
  resolvido: boolean;
  autorNome: string;
  autorEmail: string;
  /** Enviado pela conta pública: sinalizado para poder ser filtrado. */
  ehDemo: boolean;
};

export async function listarFeedback(): Promise<FeedbackRow[]> {
  const linhas = await db
    .select({
      id: schema.feedback.id,
      tipo: schema.feedback.tipo,
      mensagem: schema.feedback.mensagem,
      rota: schema.feedback.rota,
      versao: schema.feedback.versao,
      createdAt: schema.feedback.createdAt,
      lidoEm: schema.feedback.lidoEm,
      resolvidoEm: schema.feedback.resolvidoEm,
      autorNome: schema.users.name,
      autorEmail: schema.users.email,
      ehDemo: schema.users.isDemo,
    })
    .from(schema.feedback)
    .innerJoin(schema.users, eq(schema.users.id, schema.feedback.userId))
    // Mais recente primeiro: aqui o novo é o urgente, ao contrário da fila de
    // aprovação, onde quem espera há mais tempo vem antes.
    .orderBy(desc(schema.feedback.createdAt));

  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    mensagem: l.mensagem,
    rota: l.rota,
    versao: l.versao,
    criadoEm: l.createdAt.toISOString().slice(0, 10),
    lido: l.lidoEm !== null,
    resolvido: l.resolvidoEm !== null,
    autorNome: l.autorNome,
    autorEmail: l.autorEmail,
    ehDemo: l.ehDemo,
  }));
}
