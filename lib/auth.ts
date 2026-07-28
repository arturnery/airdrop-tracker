import "server-only";
import { env } from "./env";

/**
 * Identidade do usuário atual.
 *
 * Fases 1–5 não têm login: devolve o usuário semeado via variável de ambiente.
 * Toda query em `db/queries` filtra por este id, então na fase 6 basta trocar
 * o corpo desta função pela sessão do Auth.js — nenhuma query, tabela ou
 * migração muda. Ver ARCHITECTURE.md §9.
 */
export async function getCurrentUserId(): Promise<string> {
  return env.SEED_USER_ID;

  // Fase 6:
  // const session = await auth();
  // if (!session?.user?.id) redirect("/login");
  // return session.user.id;
}
