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

export async function atualizarPerfil(
  entrada: unknown,
): Promise<ResultadoPerfil> {
  const analisado = perfilSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };

  try {
    const userId = await getCurrentUserId();
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
      .set({ passwordHash: await gerarHash(analisado.data.nova) })
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
