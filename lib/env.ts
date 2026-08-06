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
  /*
   * SEED_USER_ID saiu daqui quando o login real entrou. Ela existia para fixar
   * um dono enquanto não havia sessão, e hoje só os scripts de seed a usam,
   * lendo `process.env` direto. Mantê-la obrigatória fazia a aplicação recusar
   * a subir em produção por falta de uma variável que ela não lê.
   */
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET precisa de pelo menos 32 caracteres")
    .describe("Assina os tokens de sessão: gere com `openssl rand -base64 32`"),
  ADMIN_EMAIL: z
    .email("ADMIN_EMAIL precisa ser um e-mail válido")
    .transform((v) => v.toLowerCase())
    .describe("E-mail que nasce com papel de admin: ver ARCHITECTURE.md §9.3"),
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
