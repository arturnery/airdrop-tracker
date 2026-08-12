"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { conferirSenha, gerarHash } from "@/lib/senha";
import { erros, perfilSchema, trocaSenhaSchema } from "@/lib/validators";

/**
 * Ações do próprio perfil.
 *
 * Diferente das demais, estas agem sempre sobre a conta da sessão: não recebem
 * id nenhum. Assim não existe caminho para alterar o perfil de outra pessoa,
 * nem por engano nem forjando a requisição.
 */
export type ResultadoPerfil =
  | { ok: true; aviso?: string }
  | { ok: false; erros: Record<string, string> };

/**
 * A conta de demonstração não altera o próprio cadastro.
 *
 * A senha dela é pública, então quem entrasse poderia trocá-la e trancar todo
 * mundo do lado de fora, inclusive quem mantém o projeto. O nome é travado pelo
 * mesmo motivo por outro caminho: aparece na barra lateral, e o que uma pessoa
 * escrevesse ali o próximo visitante leria.
 *
 * A checagem é aqui, no servidor, e não escondendo o formulário: esconder o
 * botão não impede a requisição direta à Server Action.
 */
async function bloqueadoPorSerDemo(userId: string): Promise<boolean> {
  const [usuario] = await db
    .select({ isDemo: schema.users.isDemo })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return usuario?.isDemo ?? false;
}

const AVISO_DEMO =
  "Esta é a conta de demonstração: nome e senha ficam fixos para todo mundo " +
  "que entra. O resto do sistema está liberado, fique à vontade.";

export async function atualizarPerfil(
  entrada: unknown,
): Promise<ResultadoPerfil> {
  const analisado = perfilSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };

  try {
    const userId = await getCurrentUserId();
    if (await bloqueadoPorSerDemo(userId)) {
      return { ok: false, erros: { geral: AVISO_DEMO } };
    }

    await db
      .update(schema.users)
      .set({ name: analisado.data.name })
      .where(eq(schema.users.id, userId));

    revalidatePath("/", "layout");
    return { ok: true, aviso: "Nome atualizado." };
  } catch (erro) {
    console.error("[perfil]", erro);
    return { ok: false, erros: { geral: "Não foi possível salvar." } };
  }
}

/**
 * Troca da própria senha.
 *
 * A senha atual é conferida no servidor antes de qualquer escrita. Um erro aqui
 * é sempre "senha atual incorreta", nunca algo que revele o estado da conta.
 */
export async function trocarSenha(entrada: unknown): Promise<ResultadoPerfil> {
  const analisado = trocaSenhaSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };

  try {
    const userId = await getCurrentUserId();
    if (await bloqueadoPorSerDemo(userId)) {
      return { ok: false, erros: { geral: AVISO_DEMO } };
    }

    const [usuario] = await db
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const confere = await conferirSenha(
      analisado.data.atual,
      usuario?.passwordHash ?? null,
    );
    if (!confere) {
      return { ok: false, erros: { atual: "Senha atual incorreta." } };
    }

    await db
      .update(schema.users)
      .set({
        passwordHash: await gerarHash(analisado.data.nova),
        // A senha agora é escolhida por quem usa: o bloqueio pode sair.
        mustChangePassword: false,
      })
      .where(eq(schema.users.id, userId));

    /*
     * A sessão continua valendo: ela foi aberta por quem acabou de provar
     * saber a senha atual. Derrubá-la faria a pessoa entrar de novo logo após
     * trocar, sem ganho de segurança.
     */
    return { ok: true, aviso: "Senha alterada. Use a nova no próximo acesso." };
  } catch (erro) {
    console.error("[senha]", erro);
    return { ok: false, erros: { geral: "Não foi possível trocar a senha." } };
  }
}
