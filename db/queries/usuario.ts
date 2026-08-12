import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";

/**
 * Dados de exibição do usuário, lidos do banco.
 *
 * Existe porque a sessão é um JWT assinado no login: o nome guardado nela
 * congela naquele momento. Trocar o nome no perfil não reemite o token, então
 * a barra lateral continuaria mostrando o antigo até a pessoa sair e entrar.
 *
 * O token segue sendo a fonte para **identidade** (id e papel, que precisam ser
 * confiáveis e não podem depender de consulta). O que é apenas exibição vem
 * daqui, sempre atual.
 */
export async function carregarUsuario(userId: string) {
  const [usuario] = await db
    .select({
      id: schema.users.id,
      nome: schema.users.name,
      email: schema.users.email,
      papel: schema.users.role,
      isDemo: schema.users.isDemo,
      precisaTrocarSenha: schema.users.mustChangePassword,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return usuario ?? null;
}
