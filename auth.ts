import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  bloqueadoPorTentativas,
  limparFalhas,
  registrarFalha,
} from "@/db/queries/tentativas";
import { conferirSenha } from "@/lib/senha";
import { loginSchema } from "@/lib/validators";

/**
 * Autenticação.
 *
 * E-mail e senha, com sessão em JWT: sem tabela de sessões, o que mantém o
 * banco enxuto e funciona bem em serverless.
 *
 * Três decisões de segurança:
 *
 * 1. **A recusa é sempre a mesma.** Senha errada, e-mail inexistente e conta
 *    não aprovada devolvem o mesmo `null`. Distinguir os casos transformaria a
 *    tela de login num verificador de quem tem conta: e de quem foi aprovado.
 *
 * 2. **`status` é verificado aqui, não só na interface.** Uma conta pendente ou
 *    recusada não abre sessão nenhuma; não adianta saber a senha.
 *
 * 3. **`role` entra no token.** Assim a guarda de administração não precisa
 *    consultar o banco a cada requisição: mas continua sendo verificada no
 *    servidor, nunca no cliente.
 *
 * 4. **Tentativas são limitadas** (§16.3). Cinco falhas em quinze minutos
 *    bloqueiam o e-mail, e o bloqueio devolve a mesma recusa de sempre: dizer
 *    "bloqueado" confirmaria que aquele endereço existe.
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

        const { email } = analisado.data;

        const [usuario] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, analisado.data.email))
          .limit(1);

        /*
         * O bloqueio é conferido antes do bcrypt, que é a parte cara: um ataque
         * em curso não deveria comprar processamento a cada tentativa.
         *
         * A demonstração fica de fora, e o motivo é que ela inverte o cálculo.
         * A senha dela está publicada no README, então não há o que descobrir
         * por tentativa e erro. Limitá-la só criaria um jeito barato de derrubar
         * a vitrine do projeto: cinco senhas erradas de propósito e a demo passa
         * quinze minutos recusando todo mundo.
         */
        if (!usuario?.isDemo && (await bloqueadoPorTentativas(email))) {
          return null;
        }

        // Mesmo sem usuário, a senha é processada: responder rápido aqui
        // revelaria quais e-mails existem pelo tempo de resposta.
        const senhaConfere = await conferirSenha(
          analisado.data.password,
          usuario?.passwordHash ?? null,
        );

        if (!usuario || !senhaConfere || usuario.status !== "aprovado") {
          /* Registra a falha mesmo sem usuário: contar só os e-mails existentes
             faria o próprio limite distinguir cadastrado de não cadastrado, que
             é o que a recusa única esconde. A demo não entra na conta, pelo
             mesmo motivo de não ser bloqueada. */
          if (!usuario?.isDemo) await registrarFalha(email);
          return null;
        }

        await limparFalhas(email);

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
