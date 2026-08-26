import "server-only";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { traduzirErroDeBanco } from "@/lib/erros-do-banco";
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
 * O `catch` traduz a recusa do banco numa frase escrita à mão, e devolve junto
 * o campo a que ela pertence, para o erro aparecer embaixo dele. O texto do
 * Postgres nunca é repassado: ele traz nome de tabela, de constraint e o valor
 * que colidiu. Ver `lib/erros-do-banco`; o detalhe fica no log do servidor.
 */
export async function executar<S extends z.ZodType>(
  schema: S,
  entrada: unknown,
  operacao: (dados: z.output<S>, userId: string) => Promise<void>,
  rotas: { caminho: string; tipo: "page" | "layout" }[] = [
    { caminho: "/", tipo: "layout" },
  ],
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
    const traduzido = traduzirErroDeBanco(erro);
    return falha(traduzido.campo, traduzido.mensagem);
  }

  for (const rota of rotas) revalidatePath(rota.caminho, rota.tipo);
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

/**
 * Rotas que dependem dos dados financeiros, revalidadas em quase toda ação.
 *
 * O Dataset é carregado no layout raiz e desce para todas as telas, então
 * qualquer escrita invalida qualquer uma delas. A lista existe porque
 * `revalidatePath` precisa de caminhos, e é escrita à mão: **quem criar tela
 * nova precisa vir aqui**, senão ela salva no banco e não atualiza sozinha.
 *
 * `/projetos/[slug]` é o padrão da rota, não um endereço. Revalidar `/projetos`
 * não alcança as páginas abaixo dela quando o segmento é dinâmico: é preciso
 * passar o padrão com o tipo, e o tipo é obrigatório nesse caso. Foi
 * exatamente essa linha que faltava, e o efeito era editar um lançamento na aba
 * do projeto, gravar no banco, e a tela não mudar.
 */
export const ROTAS_DADOS: { caminho: string; tipo: "page" | "layout" }[] = [
  { caminho: "/", tipo: "layout" },
  { caminho: "/projetos", tipo: "page" },
  { caminho: "/projetos/[slug]", tipo: "page" },
  { caminho: "/contas", tipo: "page" },
  { caminho: "/historico", tipo: "page" },
  { caminho: "/tarefas", tipo: "page" },
  { caminho: "/cotacoes", tipo: "page" },
];
