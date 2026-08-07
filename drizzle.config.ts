import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/*
 * Desenvolvimento por padrão. Produção exige `DB_ENV=producao`, dito na linha
 * de comando, porque o drizzle-kit não aceita argumentos próprios: é o mesmo
 * princípio dos scripts em `scripts/_ambiente.ts`, onde o alvo aparece no
 * comando digitado em vez de depender de um arquivo editado e esquecido.
 *
 * `npm run db:migrate:prod` já traz a variável.
 */
const producao = process.env.DB_ENV === "producao";
const arquivo = producao ? ".env.production.local" : ".env.local";

config({ path: arquivo, override: true });

if (!process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL ausente em ${arquivo}. Copie .env.example para .env.local e preencha com a connection string do Neon.`,
  );
}

console.log(
  `${producao ? "!!" : "  "} drizzle-kit em ${producao ? "PRODUÇÃO" : "desenvolvimento"}: ` +
    `${process.env.DATABASE_URL.match(/@([^/]+)/)?.[1] ?? "?"}`,
);

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  verbose: true,
  strict: true,
});
