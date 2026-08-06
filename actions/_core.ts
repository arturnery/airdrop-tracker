import "server-only";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

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
 *    usuário se tornam indistinguíveis — que é exatamente o desejado.
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

  try {
    await operacao(analisado.data, userId);
  } catch (erro) {
    console.error("[action]", erro);
    return falha("geral", "Não foi possível salvar. Tente de novo.");
  }

  for (const rota of rotas) revalidatePath(rota, "layout");
  return sucesso();
}

/** Rotas que dependem dos dados financeiros — revalidadas em quase toda ação. */
export const ROTAS_DADOS = ["/", "/projetos", "/contas", "/historico"];
