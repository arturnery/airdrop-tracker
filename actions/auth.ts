"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ehEmailDeAdmin } from "@/lib/auth";
import { gerarHash } from "@/lib/senha";
import { cadastroSchema, erros, loginSchema } from "@/lib/validators";

/**
 * Ações de entrada.
 *
 * **A navegação acontece no servidor, via `redirect()`.** A primeira versão
 * devolvia o destino e o formulário chamava `router.push()` seguido de
 * `router.refresh()`: e o refresh atropelava a navegação pendente: o servidor
 * renderizava a página nova, mas a tela não trocava.
 *
 * Com `redirect()` a resposta da ação já é o redirecionamento, então não há
 * duas navegações competindo. O retorno destas funções passa a existir apenas
 * para o caso de erro.
 */
export type ErroAuth = { erros: Record<string, string> };

/**
 * Entrada no sistema.
 *
 * A mensagem de recusa é sempre a mesma, qualquer que seja a causa: senha
 * errada, e-mail inexistente ou conta ainda não aprovada. Distinguir os casos
 * transformaria a tela num verificador de quem tem conta: e revelaria quem já
 * foi aprovado.
 */
export async function entrar(entrada: unknown): Promise<ErroAuth | void> {
  const analisado = loginSchema.safeParse(entrada);
  if (!analisado.success) return { erros: erros(analisado) };

  try {
    await signIn("credentials", {
      email: analisado.data.email,
      password: analisado.data.password,
      redirect: false,
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return {
        erros: { geral: "E-mail ou senha incorretos, ou acesso ainda não liberado." },
      };
    }
    throw erro;
  }

  // Fora do try: `redirect` funciona lançando uma exceção interna, que um
  // catch genérico engoliria.
  redirect("/");
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/entrar" });
}

/**
 * Cadastro.
 *
 * A conta nasce `pendente`: o acesso é liberado manualmente na área de
 * administração. A exceção é o e-mail configurado em `ADMIN_EMAIL`, que nasce
 * administrador e aprovado: sem isso não haveria quem aprovasse o primeiro.
 *
 * **E-mail já cadastrado não é revelado.** Dizer "este e-mail já existe"
 * permitiria descobrir quem é membro testando endereços no formulário, o que
 * entregaria a lista de assinantes para phishing direcionado.
 *
 * Em vez de simplesmente calar, a tela de espera explica os dois caminhos
 * possíveis sem confirmar qual aconteceu: quem chegou ali por engano sabe o
 * que fazer, e quem está sondando não aprende nada.
 */
export async function cadastrar(entrada: unknown): Promise<ErroAuth | void> {
  const analisado = cadastroSchema.safeParse(entrada);
  if (!analisado.success) return { erros: erros(analisado) };

  const { name, email, password } = analisado.data;
  let destino: string;

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
       * acontece: e a resposta continua idêntica, para não revelar o estado.
       */
      if (!existente.passwordHash) {
        await db
          .update(schema.users)
          .set({ name, passwordHash: hash })
          .where(eq(schema.users.id, existente.id));
      }
      /*
       * Quem já está aprovado vai para o login. Os demais caem na tela de
       * espera, igual a um cadastro novo: a diferença não pode aparecer, ou o
       * formulário viraria um verificador de contas.
       */
      destino =
        existente.status === "aprovado"
          ? "/entrar?ja=1"
          : "/aguardando-aprovacao";
    } else {
      const admin = ehEmailDeAdmin(email);

      await db.insert(schema.users).values({
        name,
        email,
        passwordHash: hash,
        role: admin ? "admin" : "membro",
        status: admin ? "aprovado" : "pendente",
        reviewedAt: admin ? new Date() : null,
      });

      destino = admin ? "/entrar" : "/aguardando-aprovacao";
    }
  } catch (erro) {
    console.error("[cadastro]", erro);
    return {
      erros: { geral: "Não foi possível concluir o cadastro. Tente de novo." },
    };
  }

  redirect(destino);
}
