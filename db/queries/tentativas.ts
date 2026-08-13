import "server-only";

import { desc, eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { bloqueadoPor, JANELA_MINUTOS, LIMITE } from "@/lib/limite-login";

/**
 * Acesso ao histórico de falhas de login. A regra em si está em
 * `lib/limite-login`, que é pura: aqui só se busca e grava.
 */
export async function bloqueadoPorTentativas(email: string): Promise<boolean> {
  /* Só as `LIMITE` falhas mais recentes importam: se elas couberem na janela,
     está bloqueado, e as anteriores não mudariam a resposta. O índice em
     (email, tentado_em) faz disso uma leitura de cinco linhas. */
  const linhas = await db
    .select({ tentadoEm: schema.loginAttempts.tentadoEm })
    .from(schema.loginAttempts)
    .where(eq(schema.loginAttempts.email, email))
    .orderBy(desc(schema.loginAttempts.tentadoEm))
    .limit(LIMITE);

  return bloqueadoPor(
    linhas.map((linha) => linha.tentadoEm),
    new Date(),
  );
}

export async function registrarFalha(email: string): Promise<void> {
  await db.insert(schema.loginAttempts).values({ email });

  /* Limpeza oportunista: sem ela a tabela cresceria para sempre guardando
     tentativas que já não contam para nada. Fica aqui em vez de num agendamento
     porque só há o que limpar quando alguém erra a senha, e a margem de quatro
     janelas evita apagar o que ainda pode pesar. */
  await db
    .delete(schema.loginAttempts)
    .where(
      lt(
        schema.loginAttempts.tentadoEm,
        sql`now() - interval '${sql.raw(String(JANELA_MINUTOS * 4))} minutes'`,
      ),
    );
}

/** Entrou: o histórico de falhas daquele e-mail deixa de importar. */
export async function limparFalhas(email: string): Promise<void> {
  await db
    .delete(schema.loginAttempts)
    .where(eq(schema.loginAttempts.email, email));
}
