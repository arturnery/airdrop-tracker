"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";

import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ehEmailDeAdmin } from "@/lib/auth";
import { gerarHash } from "@/lib/senha";
import { cadastroSchema, erros, loginSchema } from "@/lib/validators";

export type ResultadoAuth =
  | { ok: true; destino: string }
  | { ok: false; erros: Record<string, string> };

/**
 * Entrada no sistema.
 *
 * A mensagem de recusa é sempre a mesma, qualquer que seja a causa: senha
 * errada, e-mail inexistente ou conta ainda não aprovada. Distinguir os casos
 * transformaria a tela num verificador de quem tem conta — e revelaria quem já
 * foi aprovado.
 */
export async function entrar(entrada: unknown): Promise<ResultadoAuth> {
  const analisado = loginSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };

  try {
    await signIn("credentials", {
      email: analisado.data.email,
      password: analisado.data.password,
      redirect: false,
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return {
        ok: false,
        erros: { geral: "E-mail ou senha incorretos, ou acesso ainda não liberado." },
      };
    }
    throw erro;
  }

  return { ok: true, destino: "/" };
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/entrar" });
}

/**
 * Cadastro.
 *
 * A conta nasce `pendente`: o acesso é liberado manualmente na área de
 * administração. A exceção é o e-mail configurado em `ADMIN_EMAIL`, que nasce
 * administrador e aprovado — sem isso não haveria quem aprovasse o primeiro.
 *
 * **E-mail já cadastrado não é revelado.** A resposta é a mesma de um cadastro
 * novo, e a pessoa vai para a tela de espera. Dizer "este e-mail já existe"
 * permitiria descobrir quem tem conta testando endereços.
 */
export async function cadastrar(entrada: unknown): Promise<ResultadoAuth> {
  const analisado = cadastroSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };

  const { name, email, password } = analisado.data;

  try {
    const [existente] = await db
      .select({
        id: schema.users.id,
        passwordHash: schema.users.passwordHash,
        status: schema.users.status,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    const hash = await gerarHash(password);

    if (existente) {
      /*
       * Conta semeada pelo administrador existe antes de ter senha. Neste caso
       * o cadastro define a senha em vez de recusar. Se já houver senha, nada
       * acontece — e a resposta continua idêntica, para não revelar o estado.
       */
      if (!existente.passwordHash) {
        await db
          .update(schema.users)
          .set({ name, passwordHash: hash })
          .where(eq(schema.users.id, existente.id));
      }
      // Quem já está aprovado vai direto para o login; mandá-lo esperar
      // aprovação seria mentira e ele ficaria travado numa tela sem saída.
      return {
        ok: true,
        destino:
          existente.status === "aprovado" ? "/entrar" : "/aguardando-aprovacao",
      };
    }

    const admin = ehEmailDeAdmin(email);

    await db.insert(schema.users).values({
      name,
      email,
      passwordHash: hash,
      role: admin ? "admin" : "membro",
      status: admin ? "aprovado" : "pendente",
      reviewedAt: admin ? new Date() : null,
    });

    return { ok: true, destino: admin ? "/entrar" : "/aguardando-aprovacao" };
  } catch (erro) {
    console.error("[cadastro]", erro);
    return {
      ok: false,
      erros: { geral: "Não foi possível concluir o cadastro. Tente de novo." },
    };
  }
}
