import "server-only";
import { z } from "zod";

/**
 * Validação das variáveis de ambiente na inicialização.
 * Falhar aqui, com mensagem clara, é melhor que um `undefined` viajar até
 * a string de conexão e estourar em runtime na Vercel.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatória (connection string do Neon)"),
  SEED_USER_ID: z
    .uuid("SEED_USER_ID precisa ser um UUID")
    .describe("Usuário fixo enquanto não há login — ver ARCHITECTURE.md §9"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Variáveis de ambiente inválidas:\n${issues}\n\nCopie .env.example para .env.local e preencha.`,
  );
}

export const env = parsed.data;
