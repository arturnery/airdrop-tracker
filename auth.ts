import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { conferirSenha } from "@/lib/senha";
import { loginSchema } from "@/lib/validators";

/**
 * Autenticação.
 *
 * E-mail e senha, com sessão em JWT — sem tabela de sessões, o que mantém o
 * banco enxuto e funciona bem em serverless.
 *
 * Três decisões de segurança:
 *
 * 1. **A recusa é sempre a mesma.** Senha errada, e-mail inexistente e conta
 *    não aprovada devolvem o mesmo `null`. Distinguir os casos transformaria a
 *    tela de login num verificador de quem tem conta — e de quem foi aprovado.
 *
 * 2. **`status` é verificado aqui, não só na interface.** Uma conta pendente ou
 *    recusada não abre sessão nenhuma; não adianta saber a senha.
 *
 * 3. **`role` entra no token.** Assim a guarda de administração não precisa
 *    consultar o banco a cada requisição — mas continua sendo verificada no
 *    servidor, nunca no cliente.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/entrar",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credenciais) {
        const analisado = loginSchema.safeParse(credenciais);
        if (!analisado.success) return null;

        const [usuario] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, analisado.data.email))
          .limit(1);

        // Mesmo sem usuário, a senha é processada: responder rápido aqui
        // revelaria quais e-mails existem pelo tempo de resposta.
        const senhaConfere = await conferirSenha(
          analisado.data.password,
          usuario?.passwordHash ?? null,
        );

        if (!usuario || !senhaConfere) return null;
        if (usuario.status !== "aprovado") return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.name,
          role: usuario.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "membro";
      }
      return session;
    },
  },
});
