import { z } from "zod";

import { aplicarSinalDoTipo } from "./finance";
import { parseUserInput } from "./money";
import { parsePointsInput } from "./points";

/**
 * Schemas de entrada dos formulários.
 *
 * Os mesmos schemas passam a validar as Server Actions na fase de backend:
 * é o ganho de manter validação separada da UI.
 */

/** Aceita "$20.00", "20", "1.234,56"; devolve centavos inteiros. */
const valorUsd = z.string().transform((raw, ctx) => {
  const parsed = parseUserInput(raw);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", message: parsed.error });
    return z.NEVER;
  }
  return parsed.value;
});

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

const urlOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine(
    (v) => v === null || /^https?:\/\/.+/.test(v),
    "O endereço precisa começar com http:// ou https://",
  );

const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const projetoSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao projeto.").max(80),
  status: z.enum([
    "pesquisando",
    "ativo",
    "pausado",
    "tge_anunciado",
    "distribuido",
    "descartado",
  ]),
  category: z.enum(["liquidez", "interacoes", "perps"]),
  pointsLabel: textoOpcional,
  chain: textoOpcional,
  priority: z.coerce.number().int().min(1).max(5),
  websiteUrl: urlOpcional,
  discordUrl: urlOpcional,
  twitterUrl: urlOpcional,
  docsUrl: urlOpcional,
  expectedTgeDate: dataIso.nullable().or(z.literal("").transform(() => null)),
  notes: textoOpcional,
});
export type ProjetoInput = z.input<typeof projetoSchema>;

export const contaSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome à conta.").max(60),
  walletAddress: textoOpcional,
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido."),
});

export const vinculoSchema = z.object({
  projectId: z.string().min(1, "Escolha o projeto."),
  accountId: z.string().min(1, "Escolha a conta."),
  status: z.enum(["ativa", "pausada", "queimada"]),
  startedAt: dataIso,
});

export const lancamentoSchema = z.object({
  projectId: z.string().min(1, "Escolha o projeto."),
  accountId: z.string().min(1, "Escolha a conta."),
  occurredAt: dataIso,
  type: z.enum([
    "deposit",
    "withdrawal",
    "trade_pnl",
    "yield",
    "fee_gas",
    "volume_traded",
    "other",
  ]),
  amount: valorUsd,
  /** Opcionais: quando preenchidos, a posição é revalorizada pela cotação. */
  tokenSymbol: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v.toUpperCase()))
    .nullable()
    .refine(
      (v) => v === null || /^[A-Z0-9]{1,12}$/.test(v),
      "Use só letras e números, até 12 caracteres.",
    ),
  tokenAmount: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine(
      (v) => v === null || /^\d+(\.\d+)?$/.test(v),
      "Quantidade inválida.",
    ),
  description: textoOpcional,
})
  /*
   * O sinal vem do tipo, não de quem digita.
   *
   * O razão soma tudo, então retirada e taxa precisam ser negativas para
   * reduzir a posição. Antes isso dependia de a pessoa lembrar de escrever
   * "-14", e escrever "14" fazia o saque **somar** à exposição: o projeto
   * parecia ter mais dinheiro depois de tirar dinheiro dele, sem nenhum aviso.
   *
   * Aqui, e não só na tela, porque a Server Action revalida com este mesmo
   * schema: uma requisição direta receberia o mesmo tratamento.
   */
  .transform((dados) => ({
    ...dados,
    amount: aplicarSinalDoTipo(dados.type, dados.amount),
  }));

/**
 * Relato de suporte. Ver ARCHITECTURE.md §14.
 *
 * `rota` e `versao` chegam do cliente e são apenas contexto: entram como texto
 * curto e não influenciam nenhuma decisão do servidor, então um valor forjado
 * atrapalha só quem forjou.
 */
export const feedbackSchema = z.object({
  tipo: z.enum(["bug", "duvida", "sugestao"]),
  mensagem: z
    .string()
    .trim()
    .min(10, "Descreva com pelo menos 10 caracteres: relato curto demais rende ida e volta.")
    .max(2000, "Máximo de 2000 caracteres."),
  /*
   * Mesmo padrão de `textoOpcional`: vazio vira `null`, não string vazia.
   * `.nullable().or(literal(""))` não funcionaria, porque a string vazia já
   * satisfaz o primeiro ramo e o segundo nunca seria alcançado: o banco
   * receberia "" onde deveria receber NULL.
   */
  rota: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  versao: z
    .string()
    .trim()
    .max(20)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export const cotacaoSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Informe o símbolo do token.")
    .max(12)
    .transform((v) => v.toUpperCase()),
  priceUsd: valorUsd,
  updatedAt: dataIso,
});

/** Pontos usam escala própria: ver lib/points.ts. */
const quantidadePontos = z.string().transform((raw, ctx) => {
  const parsed = parsePointsInput(raw);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", message: parsed.error });
    return z.NEVER;
  }
  return parsed.value;
});

export const pontosSchema = z.object({
  projectId: z.string().min(1, "Escolha o projeto."),
  accountId: z.string().min(1, "Escolha a conta."),
  takenAt: dataIso,
  points: quantidadePontos,
  note: textoOpcional,
});

export const tarefaSchema = z.object({
  projectId: z.string().min(1, "Escolha o projeto."),
  accountId: z.string().nullable(),
  title: z.string().trim().min(1, "Descreva a tarefa.").max(100),
  description: textoOpcional,
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "every_n_days"]),
  intervalDays: z.coerce.number().int().min(1).max(365).nullable(),
  dueDate: dataIso.nullable().or(z.literal("").transform(() => null)),
});

export const metaSchema = z.object({
  projectId: z.string().min(1, "Escolha o projeto."),
  accountId: z.string().nullable(),
  title: z.string().trim().min(1, "Descreva a meta.").max(100),
  metric: z.enum(["volume_usd", "balance_usd", "tx_count", "days_active"]),
  target: valorUsd,
  deadline: dataIso.nullable().or(z.literal("").transform(() => null)),
});

/**
 * Lançamento de progresso numa meta.
 *
 * O valor aceita negativo, e isso é deliberado: volume não volta atrás, mas
 * saldo sim, e corrigir um lançamento errado sem poder subtrair obrigaria a
 * apagar e refazer. `valorUsd` já cobre o sinal.
 */
export const progressoMetaSchema = z.object({
  goalId: z.string().min(1, "Escolha a meta."),
  occurredAt: dataIso,
  value: valorUsd,
  note: z
    .string()
    .trim()
    .max(140, "Máximo de 140 caracteres.")
    .nullable()
    .or(z.literal("").transform(() => null)),
});

const numeroPositivo = (mensagem: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v), mensagem);

/**
 * Recebimento de airdrop, em duas formas de dizer a mesma coisa.
 *
 * `token`: quantidade e preço, e o valor sai da multiplicação. É o registro
 * completo, e o preferido quando os dois números são conhecidos.
 *
 * `total`: só quanto deu em dólar. Serve para quando o token já foi vendido ou
 * o número veio de um resumo da corretora. Exigir a decomposição nesse caso
 * obrigaria a inventar quantidade ou preço, e valor inventado no banco engana
 * mais do que campo vazio.
 *
 * O que os dois têm em comum é o que importa: **sempre sai um valor em dólar**,
 * que é o único número que entra no resultado.
 */
export const recebimentoSchema = z
  .object({
    projectId: z.string().min(1, "Escolha o projeto."),
    accountId: z.string().min(1, "Escolha a conta."),
    receivedAt: dataIso,
    tokenSymbol: z.string().trim().min(1, "Informe o símbolo do token.").max(20),
    modo: z.enum(["token", "total"]).default("token"),
    tokenAmount: numeroPositivo("Quantidade inválida.").optional().or(z.literal("")),
    priceUsd: numeroPositivo("Preço inválido.").optional().or(z.literal("")),
    valueUsd: numeroPositivo("Valor inválido.").optional().or(z.literal("")),
  })
  .superRefine((dados, ctx) => {
    const exigir = (campo: "tokenAmount" | "priceUsd" | "valueUsd", msg: string) => {
      if (!dados[campo]) {
        ctx.addIssue({ code: "custom", path: [campo], message: msg });
      }
    };

    if (dados.modo === "token") {
      exigir("tokenAmount", "Informe a quantidade recebida.");
      exigir("priceUsd", "Informe o preço do token.");
    } else {
      exigir("valueUsd", "Informe quanto deu em dólar.");
    }
  });

/**
 * O dólar do recebimento, venha ele de onde vier.
 *
 * Vive aqui, e não nos dois lugares que gravam, porque a ação e a mutação
 * precisam do mesmo número: a versão anterior calculava só na ação, e a mutação
 * repetia a multiplicação por conta própria.
 */
export function valorDoRecebimento(dados: {
  modo?: "token" | "total";
  tokenAmount?: string;
  priceUsd?: string;
  valueUsd?: string;
}): string {
  if (dados.modo === "total") return Number(dados.valueUsd).toFixed(2);
  return (Number(dados.tokenAmount) * Number(dados.priceUsd)).toFixed(2);
}

/** Converte os erros do Zod no formato { campo: mensagem } que os forms usam. */
export function erros(resultado: z.ZodSafeParseResult<unknown>) {
  if (resultado.success) return {};
  const mapa: Record<string, string> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path.join(".");
    if (campo && !mapa[campo]) mapa[campo] = issue.message;
  }
  return mapa;
}

// -------------------------------------------------------------- autenticação

/**
 * Schemas das telas de entrada.
 *
 * A validação de formato é definitiva e roda no cliente. A verificação de
 * credencial: se a senha confere, se o e-mail existe, se a conta foi aprovada
 *: é responsabilidade do servidor e entra com o backend (ARCHITECTURE.md §9).
 */

const email = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .pipe(z.email("E-mail inválido."))
  .transform((v) => v.toLowerCase());

/**
 * Comprimento mínimo em vez de exigir símbolo e maiúscula: regra complexa
 * empurra a pessoa para senha previsível ou anotada no papel. O que protege
 * de verdade é o hash no servidor e o limite de tentativas.
 */
const senha = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(200, "Senha longa demais.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
});

export const cadastroSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(80),
    email,
    password: senha,
    passwordConfirm: z.string(),
    accept: z.literal("on", { message: "É preciso aceitar para continuar." }),
  })
  .refine((dados) => dados.password === dados.passwordConfirm, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirm"],
  });

export const recuperarSenhaSchema = z.object({ email });

export const novaSenhaSchema = z
  .object({
    password: senha,
    passwordConfirm: z.string(),
  })
  .refine((dados) => dados.password === dados.passwordConfirm, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirm"],
  });

/** Dados do próprio perfil. O e-mail não muda: é a identidade da conta. */
export const perfilSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
});

/**
 * Troca de senha.
 *
 * Pede a senha atual mesmo com a sessão já aberta: sem isso, quem sentasse
 * num computador destravado assumiria a conta trocando a senha, e o dono
 * perderia o acesso sem entender o motivo.
 */
export const trocaSenhaSchema = z
  .object({
    atual: z.string().min(1, "Informe sua senha atual."),
    nova: senha,
    confirmacao: z.string(),
  })
  .refine((dados) => dados.nova === dados.confirmacao, {
    message: "As senhas não coincidem.",
    path: ["confirmacao"],
  })
  .refine((dados) => dados.nova !== dados.atual, {
    message: "A senha nova precisa ser diferente da atual.",
    path: ["nova"],
  });
