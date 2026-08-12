import "server-only";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { erros } from "@/lib/validators";

/**
 * Infraestrutura das Server Actions.
 *
 * Duas regras que valem para todas, e cuja violação é a origem da maior parte
 * dos vazamentos entre usuários:
 *
 * 1. **O `userId` vem da sessão, nunca do formulário.** Aceitar um id enviado
 *    pelo cliente permitiria escrever no espaço de outra pessoa mudando um
 *    campo escondido.
 * 2. **Todo UPDATE e DELETE filtra por `userId` além do id do registro.**
 *    Buscar só por id significaria que conhecer um uuid alheio basta para
 *    alterá-lo. Como efeito colateral, um id inexistente e um id de outro
 *    usuário se tornam indistinguíveis: que é exatamente o desejado.
 * 3. **Quem está com senha temporária não escreve nada.** A verificação vive
 *    aqui, e não na tela: esconder o formulário não impede a requisição direta
 *    à ação, que é o caminho que alguém interessado tentaria.
 */

export type ResultadoAcao =
  | { ok: true }
  | { ok: false; erros: Record<string, string> };

export const sucesso = (): ResultadoAcao => ({ ok: true });

export const falha = (campo: string, mensagem: string): ResultadoAcao => ({
  ok: false,
  erros: { [campo]: mensagem },
});

/**
 * Valida a entrada, resolve o usuário da sessão e executa.
 *
 * O `catch` devolve mensagem genérica de propósito: erro de banco costuma
 * conter nome de tabela, constraint e valor, que não deve chegar ao cliente.
 * O detalhe fica no log do servidor.
 */
export async function executar<S extends z.ZodType>(
  schema: S,
  entrada: unknown,
  operacao: (dados: z.output<S>, userId: string) => Promise<void>,
  rotas: string[] = ["/"],
): Promise<ResultadoAcao> {
  const analisado = schema.safeParse(entrada);
  if (!analisado.success) {
    return { ok: false, erros: erros(analisado) };
  }

  const userId = await getCurrentUserId();

  if (await precisaTrocarSenha(userId)) {
    return falha(
      "geral",
      "Defina uma senha sua antes de continuar: a temporária foi vista por " +
        "quem a gerou.",
    );
  }

  try {
    await operacao(analisado.data, userId);
  } catch (erro) {
    console.error("[action]", erro);
    return falha("geral", "Não foi possível salvar. Tente de novo.");
  }

  for (const rota of rotas) revalidatePath(rota, "layout");
  return sucesso();
}

/**
 * Conta em senha temporária: só a troca de senha é permitida.
 *
 * Consulta a cada escrita, de propósito. A marca poderia viajar no token e
 * evitar a consulta, mas o token é assinado no login e congelaria: quem
 * trocasse a senha continuaria bloqueado até sair e entrar de novo.
 *
 * `trocarSenha` não passa por aqui, então a única saída do bloqueio segue
 * aberta.
 */
async function precisaTrocarSenha(userId: string): Promise<boolean> {
  const [usuario] = await db
    .select({ marca: schema.users.mustChangePassword })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return usuario?.marca ?? false;
}

/** Rotas que dependem dos dados financeiros: revalidadas em quase toda ação. */
export const ROTAS_DADOS = ["/", "/projetos", "/contas", "/historico"];
