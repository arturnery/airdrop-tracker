import type { DefaultSession } from "next-auth";

/**
 * O papel do usuário entra na sessão para que a guarda de administração não
 * precise consultar o banco a cada requisição. A verificação continua sendo
 * feita no servidor — o cliente nunca decide o que pode ver.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "membro";
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "membro";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "membro";
  }
}
