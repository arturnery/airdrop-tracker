"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { uniqueSlug } from "@/lib/dataset";
import { toDbNumeric } from "@/lib/money";
import { toDbPoints } from "@/lib/points";
import { contasAlvoDaTarefa } from "@/lib/tarefas";
import {
  contaSchema,
  cotacaoSchema,
  lancamentoSchema,
  metaSchema,
  pontosSchema,
  projetoSchema,
  recebimentoSchema,
  tarefaSchema,
  vinculoSchema,
} from "@/lib/validators";

import { revalidatePath } from "next/cache";

import { getCurrentUserId } from "@/lib/auth";
import { gerarHash } from "@/lib/senha";

import { executar, ROTAS_DADOS, type ResultadoAcao } from "./_core";

/**
 * Server Actions.
 *
 * Cada uma valida com o mesmo schema Zod que a interface usa, resolve o usuário
 * pela sessão e escreve no banco. As regras que estavam em `lib/mutations`
 * migraram para onde é mais difícil burlá-las:
 *
 *  - a cascata virou `ON DELETE CASCADE`;
 *  - "uma medição de pontos por dia" virou `unique` + `ON CONFLICT`;
 *  - "movimento exige par projeto×conta" virou FK composta.
 *
 * `lib/mutations` continua sendo a especificação testada dessas regras.
 */

const idSchema = z.object({ id: z.uuid("Registro inválido.") });

// ------------------------------------------------------------------ projetos

export async function criarProjeto(entrada: unknown): Promise<ResultadoAcao> {
  return executar(projetoSchema, entrada, async (dados, userId) => {
    const existentes = await db
      .select({ slug: schema.projects.slug })
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId));

    await db.insert(schema.projects).values({
      userId,
      slug: uniqueSlug(dados.name, existentes.map((p) => p.slug)),
      name: dados.name,
      status: dados.status,
      category: dados.category,
      pointsLabel: dados.pointsLabel,
      chain: dados.chain,
      priority: dados.priority,
      websiteUrl: dados.websiteUrl,
      discordUrl: dados.discordUrl,
      twitterUrl: dados.twitterUrl,
      docsUrl: dados.docsUrl,
      expectedTgeDate: dados.expectedTgeDate,
      notes: dados.notes,
    });
  }, ROTAS_DADOS);
}

export async function atualizarProjeto(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(projetoSchema, entrada, async (dados, userId) => {
    // O slug não muda: está na URL e em links já compartilhados.
    await db
      .update(schema.projects)
      .set({
        name: dados.name,
        status: dados.status,
        category: dados.category,
        pointsLabel: dados.pointsLabel,
        chain: dados.chain,
        priority: dados.priority,
        websiteUrl: dados.websiteUrl,
        discordUrl: dados.discordUrl,
        twitterUrl: dados.twitterUrl,
        docsUrl: dados.docsUrl,
        expectedTgeDate: dados.expectedTgeDate,
        notes: dados.notes,
      })
      .where(
        and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)),
      );
  }, ROTAS_DADOS);
}

export async function excluirProjeto(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    // A cascata do banco leva pares, lançamentos, tarefas, metas e pontos.
    await db
      .delete(schema.projects)
      .where(
        and(eq(schema.projects.id, dados.id), eq(schema.projects.userId, userId)),
      );
  }, ROTAS_DADOS);
}

// -------------------------------------------------------------------- contas

export async function criarConta(entrada: unknown): Promise<ResultadoAcao> {
  return executar(contaSchema, entrada, async (dados, userId) => {
    await db.insert(schema.accounts).values({
      userId,
      label: dados.label,
      walletAddress: dados.walletAddress,
      email: dados.email,
    });
  }, ROTAS_DADOS);
}

export async function atualizarConta(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(contaSchema, entrada, async (dados, userId) => {
    await db
      .update(schema.accounts)
      .set({
        label: dados.label,
        walletAddress: dados.walletAddress,
        email: dados.email,
      })
      .where(
        and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)),
      );
  }, ROTAS_DADOS);
}

export async function excluirConta(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.accounts)
      .where(
        and(eq(schema.accounts.id, dados.id), eq(schema.accounts.userId, userId)),
      );
  }, ROTAS_DADOS);
}

// ------------------------------------------------------------------ vínculos

/** Garante o par projeto×conta, exigido pela FK composta dos movimentos. */
async function garantirVinculo(
  projectId: string,
  accountId: string,
  desde: string,
) {
  await db
    .insert(schema.projectAccounts)
    .values({ projectId, accountId, startedAt: desde })
    .onConflictDoNothing();
}

/** Busca os dados e delega a decisão para `contasAlvoDaTarefa`. */
async function contasDoProjeto(
  escolhida: string | null,
  projectId: string,
  userId: string,
) {
  if (escolhida) return [escolhida];

  const [vinculadas, proprias] = await Promise.all([
    db
      .select({ accountId: schema.projectAccounts.accountId })
      .from(schema.projectAccounts)
      .where(eq(schema.projectAccounts.projectId, projectId)),
    db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId)),
  ]);

  return contasAlvoDaTarefa(
    escolhida,
    vinculadas.map((v) => v.accountId),
    proprias.map((c) => c.id),
  );
}

export async function vincularConta(entrada: unknown): Promise<ResultadoAcao> {
  return executar(vinculoSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await db
      .insert(schema.projectAccounts)
      .values({
        projectId: dados.projectId,
        accountId: dados.accountId,
        status: dados.status,
        startedAt: dados.startedAt,
      })
      .onConflictDoUpdate({
        target: [schema.projectAccounts.projectId, schema.projectAccounts.accountId],
        set: { status: dados.status, startedAt: dados.startedAt },
      });
  }, ROTAS_DADOS);
}

export async function desvincularConta(
  projectId: string,
  accountId: string,
): Promise<ResultadoAcao> {
  const par = z.object({ projectId: z.uuid(), accountId: z.uuid() });
  return executar(par, { projectId, accountId }, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    // A cascata leva lançamentos, pontos e recebimentos daquele par.
    await db
      .delete(schema.projectAccounts)
      .where(
        and(
          eq(schema.projectAccounts.projectId, dados.projectId),
          eq(schema.projectAccounts.accountId, dados.accountId),
        ),
      );
  }, ROTAS_DADOS);
}

/**
 * Confirma que projeto e conta pertencem ao usuário.
 *
 * `project_accounts` não tem `user_id`: ela pende das duas pontas. Sem esta
 * verificação, alguém poderia vincular a própria conta ao projeto de outro
 * enviando os uuids na requisição.
 */
async function exigirDono(projectId: string, accountId: string, userId: string) {
  const [projeto] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
    .limit(1);

  const [conta] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.userId, userId)))
    .limit(1);

  if (!projeto || !conta) {
    throw new Error("Projeto ou conta não pertence ao usuário.");
  }
}

// --------------------------------------------------------------- lançamentos

export async function criarLancamento(entrada: unknown): Promise<ResultadoAcao> {
  return executar(lancamentoSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.occurredAt);

    await db.insert(schema.transactions).values({
      userId,
      projectId: dados.projectId,
      accountId: dados.accountId,
      occurredAt: dados.occurredAt,
      type: dados.type,
      amountUsd: toDbNumeric(dados.amount),
      tokenSymbol: dados.tokenSymbol,
      tokenAmount: dados.tokenAmount,
      description: dados.description,
    });
  }, ROTAS_DADOS);
}

export async function atualizarLancamento(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(lancamentoSchema, entrada, async (dados, userId) => {
    await db
      .update(schema.transactions)
      .set({
        occurredAt: dados.occurredAt,
        type: dados.type,
        amountUsd: toDbNumeric(dados.amount),
        tokenSymbol: dados.tokenSymbol,
        tokenAmount: dados.tokenAmount,
        description: dados.description,
      })
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, userId),
        ),
      );
  }, ROTAS_DADOS);
}

export async function excluirLancamento(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, dados.id),
          eq(schema.transactions.userId, userId),
        ),
      );
  }, ROTAS_DADOS);
}

// ------------------------------------------------------------------ cotações

export async function definirCotacao(entrada: unknown): Promise<ResultadoAcao> {
  return executar(cotacaoSchema, entrada, async (dados, userId) => {
    await db
      .insert(schema.tokenPrices)
      .values({
        userId,
        symbol: dados.symbol,
        priceUsd: toDbNumeric(dados.priceUsd),
        updatedAt: dados.updatedAt,
      })
      // Um preço por símbolo: reinformar substitui.
      .onConflictDoUpdate({
        target: [schema.tokenPrices.userId, schema.tokenPrices.symbol],
        set: { priceUsd: toDbNumeric(dados.priceUsd), updatedAt: dados.updatedAt },
      });
  }, [...ROTAS_DADOS, "/cotacoes"]);
}

export async function excluirCotacao(symbol: string): Promise<ResultadoAcao> {
  const esquema = z.object({ symbol: z.string().min(1).max(12) });
  return executar(esquema, { symbol }, async (dados, userId) => {
    await db
      .delete(schema.tokenPrices)
      .where(
        and(
          eq(schema.tokenPrices.userId, userId),
          eq(schema.tokenPrices.symbol, dados.symbol.toUpperCase()),
        ),
      );
  }, [...ROTAS_DADOS, "/cotacoes"]);
}

// -------------------------------------------------------------------- pontos

export async function registrarPontos(entrada: unknown): Promise<ResultadoAcao> {
  return executar(pontosSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.takenAt);

    await db
      .insert(schema.pointsSnapshots)
      .values({
        userId,
        projectId: dados.projectId,
        accountId: dados.accountId,
        takenAt: dados.takenAt,
        points: toDbPoints(dados.points),
        note: dados.note,
      })
      // Uma medição por par por dia: reinformar corrige em vez de duplicar.
      .onConflictDoUpdate({
        target: [
          schema.pointsSnapshots.projectId,
          schema.pointsSnapshots.accountId,
          schema.pointsSnapshots.takenAt,
        ],
        set: { points: toDbPoints(dados.points), note: dados.note },
      });
  }, ROTAS_DADOS);
}

export async function excluirPontos(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.pointsSnapshots)
      .where(
        and(
          eq(schema.pointsSnapshots.id, dados.id),
          eq(schema.pointsSnapshots.userId, userId),
        ),
      );
  }, ROTAS_DADOS);
}

// ------------------------------------------------------------------- tarefas

export async function criarTarefa(entrada: unknown): Promise<ResultadoAcao> {
  return executar(tarefaSchema, entrada, async (dados, userId) => {
    const [tarefa] = await db
      .insert(schema.tasks)
      .values({
        userId,
        projectId: dados.projectId,
        accountId: dados.accountId,
        title: dados.title,
        description: dados.description,
        recurrence: dados.recurrence,
        intervalDays: dados.intervalDays,
        dueDate: dados.dueDate,
      })
      .returning({ id: schema.tasks.id });

    const contasAlvo = await contasDoProjeto(
      dados.accountId,
      dados.projectId,
      userId,
    );

    const vencimento = dados.dueDate ?? new Date().toISOString().slice(0, 10);

    /*
     * Sem ocorrência a tarefa não aparece em lugar nenhum: a tela lista
     * ocorrências, não tarefas. Criar a tarefa e parar por aqui produziria um
     * registro invisível, que foi exatamente o que aconteceu em produção.
     */
    if (contasAlvo.length === 0) {
      throw new Error(
        "Cadastre uma conta antes de criar tarefas: é nela que a tarefa aparece.",
      );
    }

    await db
      .insert(schema.taskOccurrences)
      .values(
        contasAlvo.map((accountId) => ({
          taskId: tarefa!.id,
          accountId,
          dueDate: vencimento,
        })),
      )
      .onConflictDoNothing();
  }, [...ROTAS_DADOS, "/tarefas"]);
}

export async function atualizarTarefa(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  const comAtiva = tarefaSchema.extend({ isActive: z.boolean() });
  return executar(comAtiva, entrada, async (dados, userId) => {
    const [atualizada] = await db
      .update(schema.tasks)
      .set({
        title: dados.title,
        description: dados.description,
        recurrence: dados.recurrence,
        intervalDays: dados.intervalDays,
        dueDate: dados.dueDate,
        accountId: dados.accountId,
        isActive: dados.isActive,
      })
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)))
      .returning({ id: schema.tasks.id });

    /*
     * A data também precisa descer para as ocorrências.
     *
     * A tela lista ocorrências, não tarefas, e cada uma guarda o próprio
     * vencimento. Mudar só `tasks.dueDate` alterava um campo que ninguém
     * exibe: a edição era salva e a tela seguia mostrando a data antiga, como
     * se nada tivesse acontecido.
     *
     * Só as pendentes mudam. Ocorrência concluída é histórico: a data em que
     * algo venceu e foi feito não muda porque a tarefa foi reagendada depois.
     */
    if (atualizada && dados.dueDate) {
      await db
        .update(schema.taskOccurrences)
        .set({ dueDate: dados.dueDate })
        .where(
          and(
            eq(schema.taskOccurrences.taskId, id),
            isNull(schema.taskOccurrences.completedAt),
          ),
        );
    }
  }, [...ROTAS_DADOS, "/tarefas"]);
}

export async function excluirTarefa(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.tasks)
      .where(and(eq(schema.tasks.id, dados.id), eq(schema.tasks.userId, userId)));
  }, [...ROTAS_DADOS, "/tarefas"]);
}

export async function alternarOcorrencia(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    // A ocorrência não tem user_id: o vínculo é pela tarefa, checada no join.
    const [ocorrencia] = await db
      .select({
        id: schema.taskOccurrences.id,
        completedAt: schema.taskOccurrences.completedAt,
      })
      .from(schema.taskOccurrences)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskOccurrences.taskId))
      .where(
        and(
          eq(schema.taskOccurrences.id, dados.id),
          eq(schema.tasks.userId, userId),
        ),
      )
      .limit(1);

    if (!ocorrencia) throw new Error("Ocorrência não encontrada.");

    await db
      .update(schema.taskOccurrences)
      .set({ completedAt: ocorrencia.completedAt ? null : sql`now()` })
      .where(eq(schema.taskOccurrences.id, dados.id));
  }, [...ROTAS_DADOS, "/tarefas"]);
}

// --------------------------------------------------------------------- metas

export async function atualizarMeta(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(metaSchema, entrada, async (dados, userId) => {
    /*
     * `projectId` não é alterado: mover uma meta de projeto mudaria o
     * significado dela, e o valor atual é derivado dos lançamentos daquele
     * projeto. Quem quer medir outro projeto cria outra meta.
     */
    await db
      .update(schema.goals)
      .set({
        accountId: dados.accountId,
        title: dados.title,
        metric: dados.metric,
        targetValue: toDbNumeric(dados.target),
        deadline: dados.deadline,
      })
      .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)));
  }, ROTAS_DADOS);
}

export async function criarMeta(entrada: unknown): Promise<ResultadoAcao> {
  return executar(metaSchema, entrada, async (dados, userId) => {
    await db.insert(schema.goals).values({
      userId,
      projectId: dados.projectId,
      accountId: dados.accountId,
      title: dados.title,
      metric: dados.metric,
      targetValue: toDbNumeric(dados.target),
      deadline: dados.deadline,
    });
  }, ROTAS_DADOS);
}

export async function excluirMeta(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.goals)
      .where(and(eq(schema.goals.id, dados.id), eq(schema.goals.userId, userId)));
  }, ROTAS_DADOS);
}

// -------------------------------------------------------------- recebimentos

export async function registrarRecebimento(
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(recebimentoSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.receivedAt);

    // Valor congelado no registro: o preço muda depois, o histórico não.
    const valueUsd = (
      Number(dados.tokenAmount) * Number(dados.priceUsd)
    ).toFixed(2);

    await db.insert(schema.airdropClaims).values({
      userId,
      projectId: dados.projectId,
      accountId: dados.accountId,
      receivedAt: dados.receivedAt,
      tokenSymbol: dados.tokenSymbol.toUpperCase(),
      tokenAmount: dados.tokenAmount,
      priceUsd: dados.priceUsd,
      valueUsd,
    });
  }, ROTAS_DADOS);
}

export async function excluirRecebimento(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.airdropClaims)
      .where(
        and(
          eq(schema.airdropClaims.id, dados.id),
          eq(schema.airdropClaims.userId, userId),
        ),
      );
  }, ROTAS_DADOS);
}

// ------------------------------------------------------------------ membros

/**
 * Revisão de solicitação de acesso.
 *
 * Diferente das demais, esta ação não age sobre dados do próprio usuário: ela
 * altera OUTRA conta. Por isso a guarda é de papel, não de posse: só quem é
 * administrador pode decidir quem entra.
 */
const revisaoSchema = z.object({
  id: z.uuid("Registro inválido."),
  status: z.enum(["aprovado", "recusado"]),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

async function exigirAdministrador(userId: string) {
  const [usuario] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (usuario?.role !== "admin") {
    throw new Error("Ação restrita ao administrador.");
  }
}

export async function revisarMembro(entrada: unknown): Promise<ResultadoAcao> {
  return executar(revisaoSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db
      .update(schema.users)
      .set({
        status: dados.status,
        reviewNote: dados.note,
        reviewedAt: sql`now()`,
      })
      // Nunca sobre um admin: evita rebaixar a si mesmo por engano.
      .where(and(eq(schema.users.id, dados.id), ne(schema.users.role, "admin")));
  }, ["/membros"]);
}

/** Devolve para a fila: serve tanto para revogar acesso quanto reconsiderar. */
export async function reabrirMembro(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db
      .update(schema.users)
      .set({ status: "pendente", reviewedAt: null, reviewNote: null })
      .where(and(eq(schema.users.id, dados.id), ne(schema.users.role, "admin")));
  }, ["/membros"]);
}

/**
 * Gera uma senha temporária para um membro.
 *
 * Existe porque não há envio de e-mail: quem esquece a senha fala com o
 * administrador, que gera uma provisória e entrega por onde já conversa com a
 * comunidade. Para um grupo em que as pessoas se conhecem, isso é mais
 * confiável que um link por e-mail, que pode cair em spam ou ser interceptado.
 *
 * A senha é devolvida **uma única vez**, no retorno desta ação. O banco guarda
 * só o hash, então não há como consultá-la depois: se o administrador perder,
 * gera outra.
 */
export async function redefinirSenhaDeMembro(
  id: string,
): Promise<{ ok: true; senha: string } | { ok: false; erro: string }> {
  const analisado = idSchema.safeParse({ id });
  if (!analisado.success) return { ok: false, erro: "Registro inválido." };

  try {
    const userId = await getCurrentUserId();
    await exigirAdministrador(userId);

    const senha = gerarSenhaTemporaria();
    const resultado = await db
      .update(schema.users)
      .set({
        passwordHash: await gerarHash(senha),
        /*
         * Quem entra com uma senha que não escolheu precisa trocá-la antes de
         * usar o sistema. Enquanto a marca estiver ligada, o acesso fica
         * restrito à própria troca: quem administra viu esta senha, então ela
         * não pode continuar valendo.
         */
        mustChangePassword: true,
      })
      // Nunca sobre outro admin: senha de administrador não se redefine por
      // aqui, para que ninguém assuma a conta de quem administra.
      .where(and(eq(schema.users.id, analisado.data.id), ne(schema.users.role, "admin")))
      .returning({ id: schema.users.id });

    if (resultado.length === 0) {
      return { ok: false, erro: "Membro não encontrado." };
    }

    // Tira o pedido da fila: o que estava pendente acabou de ser atendido.
    await db
      .update(schema.passwordResetRequests)
      .set({ resolvedAt: sql`now()` })
      .where(
        and(
          eq(schema.passwordResetRequests.userId, analisado.data.id),
          isNull(schema.passwordResetRequests.resolvedAt),
        ),
      );

    revalidatePath("/membros");
    return { ok: true, senha };
  } catch (erro) {
    console.error("[redefinir senha]", erro);
    return { ok: false, erro: "Não foi possível redefinir. Tente de novo." };
  }
}

/**
 * Senha provisória legível: blocos separados por hífen, sem caracteres que se
 * confundem ao ditar (0/O, 1/l/I). Quem recebe precisa conseguir digitar.
 */
function gerarSenhaTemporaria(): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  const bloco = () =>
    Array.from(
      { length: 4 },
      () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
    ).join("");
  return `${bloco()}-${bloco()}-${bloco()}`;
}
