import "server-only";
import { z } from "zod";

/**
 * Validação das variáveis de ambiente na inicialização.
 * Falhar aqui, com mensagem clara, é melhor que um `undefined` viajar até
 * a string de conexão e estourar em runtime na Vercel.
 */
const vazioComoAusente = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

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
  /*
   * IA que interpreta lançamentos escritos em frase (`actions/ia.ts`).
   * Opcional: sem a chave, o resto do sistema sobe normal e só esse recurso
   * responde que não está configurado. Qualquer provedor com API no formato
   * da OpenAI serve; o padrão é o DeepSeek, pelo custo.
   *
   * Vazio conta como ausente: o `.env.example` traz `IA_API_KEY=""`, e uma
   * cópia dele sem preencher não pode impedir o sistema de subir.
   */
  IA_API_KEY: z.preprocess(vazioComoAusente, z.string().optional()),
  IA_BASE_URL: z.preprocess(
    vazioComoAusente,
    z.url().default("https://api.deepseek.com"),
  ),
  IA_MODELO: z.preprocess(vazioComoAusente, z.string().default("deepseek-chat")),
  /** Consultado junto com o principal: vale a primeira resposta que servir. */
  IA_MODELO_RESERVA: z.preprocess(vazioComoAusente, z.string().optional()),
  /*
   * Segundo provedor, consultado junto: quando um provedor inteiro
   * sobrecarrega, os modelos dele caem juntos. Vale só com os três.
   */
  IA2_API_KEY: z.preprocess(vazioComoAusente, z.string().optional()),
  IA2_BASE_URL: z.preprocess(vazioComoAusente, z.url().optional()),
  IA2_MODELO: z.preprocess(vazioComoAusente, z.string().optional()),
  /*
   * IA dos avisos (anúncio colado vira texto para a comunidade). Opcional:
   * sem estas, os avisos usam o segundo provedor (IA2_*), que é só texto.
   * O Gemini (IA_*) fica de fora de propósito: ele é reservado aos prints de
   * operação, os únicos que precisam de um modelo que lê imagem.
   */
  IA_AVISO_API_KEY: z.preprocess(vazioComoAusente, z.string().optional()),
  IA_AVISO_BASE_URL: z.preprocess(vazioComoAusente, z.url().optional()),
  IA_AVISO_MODELO: z.preprocess(vazioComoAusente, z.string().optional()),
  /** Consultado junto com o modelo dos avisos, no mesmo provedor. */
  IA_AVISO_MODELO_RESERVA: z.preprocess(vazioComoAusente, z.string().optional()),
  /*
   * Webhook do canal do Discord onde os sinais de trade são avisados.
   * Opcional: sem ele, o sinal é publicado só no site. Só o endereço de
   * webhook do Discord é aceito, para um erro de cópia não mandar os sinais
   * para outro lugar.
   */
  DISCORD_WEBHOOK_SINAIS: z.preprocess(
    vazioComoAusente,
    z
      .url()
      .refine(
        (u) => /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(u),
        "DISCORD_WEBHOOK_SINAIS precisa ser um webhook do Discord (https://discord.com/api/webhooks/...)",
      )
      .optional(),
  ),
  /*
   * Conta do Gmail que envia o e-mail de "acesso liberado" (`lib/email.ts`).
   * Opcional: sem as duas, a aprovação funciona e a tela de membros avisa
   * que o e-mail não foi enviado. A senha é a "senha de app" de 16 letras do
   * Google, não a senha da conta; os espaços com que o Google a mostra caem.
   */
  GMAIL_USUARIO: z.preprocess(vazioComoAusente, z.email("GMAIL_USUARIO precisa ser um e-mail").optional()),
  GMAIL_SENHA_APP: z.preprocess(
    (v) => (typeof v === "string" ? vazioComoAusente(v.replace(/\s+/g, "")) : v),
    z.string().optional(),
  ),
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
