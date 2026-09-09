"use server";

import { and, eq, gte, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { uniqueSlug } from "@/lib/dataset";
import { toDbNumeric } from "@/lib/money";
import { toDbPoints } from "@/lib/points";
import { dataDeHoje } from "@/lib/dates";
import { contasAlvoDaTarefa } from "@/lib/tarefas";
import {
  adocaoSchema,
  contaSchema,
  cotacaoSchema,
  destaqueSchema,
  lancamentoSchema,
  metaSchema,
  pontosSchema,
  progressoMetaSchema,
  projetoSchema,
  recebimentoSchema,
  tarefaSchema,
  valorDoRecebimento,
  vinculoSchema,
  volumeSchema,
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

// ------------------------------------------------------- catálogo da comunidade

/**
 * Publica ou atualiza a entrada de um projeto no catálogo (ARCHITECTURE §13).
 *
 * Só quem administra publica: a curadoria é o produto, e a guarda de papel
 * (`exigirAdministrador`) é a real, não o botão escondido na tela. O projeto
 * também precisa ser do próprio administrador: a leitura que copia os campos
 * filtra por `userId` além do id, do jeito que toda leitura sensível deste
 * sistema filtra.
 *
 * O nome da função serve para os dois casos, criar e atualizar, porque a
 * pessoa não escolhe entre eles: se já existe uma entrada para este projeto
 * (achada por `sourceProjectId`), os campos são recopiados por cima dela; se
 * não, nasce uma nova. `publishedAt` sempre vira `now()`, então republicar
 * uma entrada removida também é este mesmo caminho.
 */
export async function destacarProjeto(
  projectId: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(destaqueSchema, entrada, async (dados, userId) => {
    await exigirAdministrador(userId);

    const [projeto] = await db
      .select()
      .from(schema.projects)
      .where(
        and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)),
      )
      .limit(1);

    if (!projeto) {
      throw new Error("Projeto inexistente ou de outro usuário.");
    }

    const campos = {
      name: projeto.name,
      category: projeto.category,
      pointsLabel: projeto.pointsLabel,
      chain: projeto.chain,
      priority: projeto.priority,
      websiteUrl: projeto.websiteUrl,
      discordUrl: projeto.discordUrl,
      twitterUrl: projeto.twitterUrl,
      docsUrl: projeto.docsUrl,
      expectedTgeDate: projeto.expectedTgeDate,
      summary: dados.summary,
      publishedAt: sql`now()`,
      updatedAt: sql`now()`,
    };

    const [existente] = await db
      .select({ id: schema.catalogProjects.id })
      .from(schema.catalogProjects)
      .where(eq(schema.catalogProjects.sourceProjectId, projectId))
      .limit(1);

    if (existente) {
      await db
        .update(schema.catalogProjects)
        .set(campos)
        .where(eq(schema.catalogProjects.id, existente.id));
      return;
    }

    /*
     * O slug do catálogo é independente do slug do projeto: dois admins com
     * um projeto de mesmo nome não podem colidir num campo que é único para
     * o catálogo inteiro, e não por usuário como o slug de `projects`.
     */
    const existentes = await db
      .select({ slug: schema.catalogProjects.slug })
      .from(schema.catalogProjects);
    const slug = uniqueSlug(
      projeto.name,
      existentes.map((e) => e.slug),
    );

    await db.insert(schema.catalogProjects).values({
      slug,
      ...campos,
      createdBy: userId,
      sourceProjectId: projectId,
    });
  }, ROTAS_DADOS);
}

/**
 * Tira um projeto do catálogo, sem apagar a entrada nem quem já a adotou.
 *
 * `publishedAt: null` é o único estado de "fora do catálogo" (ver a nota em
 * `db/schema.ts`). A linha continua existindo para uma republicação futura
 * reaproveitar o mesmo id, em vez de duplicar.
 */
export async function removerDestaque(projectId: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id: projectId }, async (dados, userId) => {
    await exigirAdministrador(userId);

    const [projeto] = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(
        and(eq(schema.projects.id, dados.id), eq(schema.projects.userId, userId)),
      )
      .limit(1);

    if (!projeto) {
      throw new Error("Projeto inexistente ou de outro usuário.");
    }

    await db
      .update(schema.catalogProjects)
      .set({ publishedAt: null, updatedAt: sql`now()` })
      .where(eq(schema.catalogProjects.sourceProjectId, dados.id));
  }, ROTAS_DADOS);
}

/**
 * Adota uma entrada do catálogo: copia os campos editoriais para um projeto
 * novo, inteiramente de quem adotou.
 *
 * **Cópia, não vínculo** (§13.3): a partir daqui o projeto é indistinguível
 * de um criado à mão. `adoptedFromId` fica gravado só para não oferecer a
 * mesma entrada de novo e para o `unique(userId, adoptedFromId)` do banco
 * impedir adotar duas vezes.
 *
 * Qualquer pessoa com sessão pode adotar: chegar até aqui já exige conta
 * aprovada, porque o login recusa quem não está (`auth.ts`).
 */
export async function adotarDoCatalogo(entrada: unknown): Promise<ResultadoAcao> {
  return executar(adocaoSchema, entrada, async (dados, userId) => {
    const [item] = await db
      .select()
      .from(schema.catalogProjects)
      .where(
        and(
          eq(schema.catalogProjects.id, dados.catalogId),
          isNotNull(schema.catalogProjects.publishedAt),
        ),
      )
      .limit(1);

    if (!item) {
      throw new Error(
        "Esta entrada não existe mais, ou foi retirada do catálogo.",
      );
    }

    const doUsuario = await db
      .select({ slug: schema.projects.slug })
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId));
    const slug = uniqueSlug(
      item.name,
      doUsuario.map((p) => p.slug),
    );

    await db.insert(schema.projects).values({
      userId,
      slug,
      name: item.name,
      category: item.category,
      pointsLabel: item.pointsLabel,
      chain: item.chain,
      // Ponto de partida, não vínculo: a partir daqui é o valor de quem
      // adotou, e muda sem afetar o do catálogo.
      priority: item.priority,
      websiteUrl: item.websiteUrl,
      discordUrl: item.discordUrl,
      twitterUrl: item.twitterUrl,
      docsUrl: item.docsUrl,
      expectedTgeDate: item.expectedTgeDate,
      adoptedFromId: item.id,
    });
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
    /*
     * A conta pode mudar: lançar na carteira errada é o engano mais comum, e
     * antes só restava apagar e refazer.
     *
     * `exigirDono` confirma que projeto e conta são de quem edita, porque o
     * accountId chega do formulário. `garantirVinculo` cria o par
     * projeto×conta se ainda não existir: a FK composta dos movimentos exige
     * que ele exista, e mover o lançamento para uma conta nunca usada naquele
     * projeto é justamente um caso em que ele não existe.
     */
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.occurredAt);

    await db
      .update(schema.transactions)
      .set({
        accountId: dados.accountId,
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
  }, ROTAS_DADOS);
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
  }, ROTAS_DADOS);
}

// -------------------------------------------------------------------- pontos

/**
 * Medição de volume acumulado.
 *
 * Espelha `registrarPontos`, inclusive no `onConflictDoUpdate`: reinformar a
 * medição do mesmo dia corrige, em vez de criar uma segunda que produziria
 * variação falsa entre elas.
 */
export async function registrarVolume(entrada: unknown): Promise<ResultadoAcao> {
  return executar(volumeSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.takenAt);

    await db
      .insert(schema.volumeSnapshots)
      .values({
        userId,
        projectId: dados.projectId,
        accountId: dados.accountId,
        takenAt: dados.takenAt,
        volumeUsd: toDbNumeric(dados.volume),
        note: dados.note,
      })
      .onConflictDoUpdate({
        target: [
          schema.volumeSnapshots.projectId,
          schema.volumeSnapshots.accountId,
          schema.volumeSnapshots.takenAt,
        ],
        set: { volumeUsd: toDbNumeric(dados.volume), note: dados.note },
      });
  }, ROTAS_DADOS);
}

/**
 * Correção de uma medição já registrada.
 *
 * Existe porque a alternativa era apagar e lançar de novo, e numa série de
 * acumulado isso é pior do que parece: apagar a medição do meio muda o ganho
 * do período seguinte, que passa a ser medido contra a medição anterior a ela.
 * Corrigir no lugar mantém a série inteira.
 *
 * A conta pode mudar (medir na conta errada é fácil), a data também. O projeto
 * não: mover a medição de projeto mudaria dois totais de uma vez.
 */
export async function atualizarVolume(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(volumeSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.takenAt);

    await db
      .update(schema.volumeSnapshots)
      .set({
        accountId: dados.accountId,
        takenAt: dados.takenAt,
        volumeUsd: toDbNumeric(dados.volume),
        note: dados.note,
      })
      .where(
        and(
          eq(schema.volumeSnapshots.id, id),
          eq(schema.volumeSnapshots.userId, userId),
        ),
      );
  }, ROTAS_DADOS);
}

export async function excluirVolume(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.volumeSnapshots)
      .where(
        and(
          eq(schema.volumeSnapshots.id, dados.id),
          eq(schema.volumeSnapshots.userId, userId),
        ),
      );
  }, ROTAS_DADOS);
}

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

/** Correção de uma medição de pontos. Mesmas regras do volume. */
export async function atualizarPontos(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(pontosSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.takenAt);

    await db
      .update(schema.pointsSnapshots)
      .set({
        accountId: dados.accountId,
        takenAt: dados.takenAt,
        points: toDbPoints(dados.points),
        note: dados.note,
      })
      .where(
        and(
          eq(schema.pointsSnapshots.id, id),
          eq(schema.pointsSnapshots.userId, userId),
        ),
      );
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
  }, ROTAS_DADOS);
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
     * A data precisa descer para as ocorrências, porque a tela lista
     * ocorrências e cada uma guarda o próprio vencimento. Mas o que fazer com
     * elas depende do tipo de tarefa, e tratar os dois casos igual quebrava.
     *
     * **Prazo fixo** tem uma ocorrência por conta: mudar a data dela é
     * exatamente o que se espera ao remarcar o prazo.
     *
     * **Recorrente** tem dezenas, materializadas pelo motor (§6). Empurrar
     * todas para a mesma data violava `unique(task_id, account_id, due_date)`,
     * e a ação inteira falhava com "não foi possível salvar". A constraint
     * evitou a corrupção que a lógica teria causado.
     *
     * Para recorrente, `dueDate` é a **âncora da série**, não a data de uma
     * ocorrência: mudá-la significa reagendar dali para a frente. Então as
     * pendentes futuras são apagadas e o motor as recria pela nova regra na
     * próxima leitura. As atrasadas ficam, porque são dívida acumulada e não
     * somem porque a tarefa foi reagendada.
     */
    if (atualizada && dados.dueDate) {
      if (dados.recurrence === "none") {
        await db
          .update(schema.taskOccurrences)
          .set({ dueDate: dados.dueDate })
          .where(
            and(
              eq(schema.taskOccurrences.taskId, id),
              isNull(schema.taskOccurrences.completedAt),
            ),
          );
      } else {
        const hoje = dataDeHoje();
        await db
          .delete(schema.taskOccurrences)
          .where(
            and(
              eq(schema.taskOccurrences.taskId, id),
              isNull(schema.taskOccurrences.completedAt),
              gte(schema.taskOccurrences.dueDate, hoje),
            ),
          );
      }
    }
  }, ROTAS_DADOS);
}

export async function excluirTarefa(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await db
      .delete(schema.tasks)
      .where(and(eq(schema.tasks.id, dados.id), eq(schema.tasks.userId, userId)));
  }, ROTAS_DADOS);
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
  }, ROTAS_DADOS);
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

/**
 * Progresso lançado numa meta.
 *
 * `goal_entries` não tem `user_id`: pende de `goals`, que tem. O dono é
 * conferido aqui, com um SELECT que filtra pelos dois, e não por confiar no id
 * que veio do formulário. Sem essa checagem, conhecer o uuid de uma meta alheia
 * bastaria para escrever nela, que é exatamente o buraco que a regra do
 * `actions/_core.ts` fecha nas tabelas que têm a coluna.
 */
export async function lancarProgressoMeta(
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(progressoMetaSchema, entrada, async (dados, userId) => {
    const [meta] = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(and(eq(schema.goals.id, dados.goalId), eq(schema.goals.userId, userId)))
      .limit(1);

    if (!meta) throw new Error("meta inexistente ou de outro usuário");

    await db.insert(schema.goalEntries).values({
      goalId: dados.goalId,
      occurredAt: dados.occurredAt,
      value: toDbNumeric(dados.value),
      note: dados.note,
    });
  }, ROTAS_DADOS);
}

/**
 * Correção de um progresso lançado.
 *
 * O UPDATE passa por `goals` para chegar ao dono, pelo mesmo motivo do DELETE
 * logo abaixo: `goal_entries` não tem `user_id`, e filtrar só pelo id do
 * lançamento deixaria qualquer uuid conhecido editável por qualquer pessoa.
 *
 * A meta não muda. Mover progresso de uma meta para outra alteraria duas
 * barras ao mesmo tempo, e quem quer isso apaga aqui e lança lá, onde as duas
 * mudanças ficam visíveis.
 */
export async function atualizarProgressoMeta(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(progressoMetaSchema, entrada, async (dados, userId) => {
    const metasDoDono = db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(eq(schema.goals.userId, userId));

    await db
      .update(schema.goalEntries)
      .set({
        occurredAt: dados.occurredAt,
        value: toDbNumeric(dados.value),
        note: dados.note,
      })
      .where(
        and(
          eq(schema.goalEntries.id, id),
          inArray(schema.goalEntries.goalId, metasDoDono),
        ),
      );
  }, ROTAS_DADOS);
}

export async function excluirProgressoMeta(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    /*
     * O DELETE passa por `goals` para chegar ao dono. Apagar só por id do
     * lançamento deixaria qualquer uuid conhecido apagável por qualquer pessoa,
     * e o `goal_entries` não tem coluna própria para filtrar.
     */
    const metasDoDono = db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(eq(schema.goals.userId, userId));

    await db
      .delete(schema.goalEntries)
      .where(
        and(
          eq(schema.goalEntries.id, dados.id),
          inArray(schema.goalEntries.goalId, metasDoDono),
        ),
      );
  }, ROTAS_DADOS);
}

// -------------------------------------------------------------- recebimentos

export async function registrarRecebimento(
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(recebimentoSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.receivedAt);

    const porToken = dados.modo === "token";

    await db.insert(schema.airdropClaims).values({
      userId,
      projectId: dados.projectId,
      accountId: dados.accountId,
      receivedAt: dados.receivedAt,
      tokenSymbol: dados.tokenSymbol.toUpperCase(),
      // Nulos quando o total veio direto: guardar zero diria "recebi zero
      // token a zero dólar", que é uma afirmação, e não a ausência dela.
      tokenAmount: porToken ? dados.tokenAmount : null,
      priceUsd: porToken ? dados.priceUsd : null,
      // Congelado no registro: o preço muda depois, o histórico não.
      valueUsd: valorDoRecebimento(dados),
    });
  }, ROTAS_DADOS);
}

/**
 * Correção de um recebimento.
 *
 * O valor em dólar é recalculado, e não preservado: ele é derivado de
 * quantidade × preço, e manter o antigo depois de corrigir a quantidade
 * guardaria uma multiplicação que não fecha. `valorDoRecebimento` é a mesma
 * função do registro, para os dois caminhos não divergirem.
 *
 * Trocar de modo é permitido, e é metade do motivo desta ação existir: quem
 * lançou o total em dólar e depois descobriu a quantidade exata completava o
 * registro apagando e refazendo.
 */
export async function atualizarRecebimento(
  id: string,
  entrada: unknown,
): Promise<ResultadoAcao> {
  return executar(recebimentoSchema, entrada, async (dados, userId) => {
    await exigirDono(dados.projectId, dados.accountId, userId);
    await garantirVinculo(dados.projectId, dados.accountId, dados.receivedAt);

    const porToken = dados.modo === "token";

    await db
      .update(schema.airdropClaims)
      .set({
        accountId: dados.accountId,
        receivedAt: dados.receivedAt,
        tokenSymbol: dados.tokenSymbol.toUpperCase(),
        /*
         * `?? null` explícito, e não `undefined`: num UPDATE do Drizzle, campo
         * indefinido é campo que **não entra no SET**, então o valor antigo
         * sobreviveria à troca de modo. No INSERT os dois dariam no mesmo, e é
         * essa diferença silenciosa que faz o copiar-e-colar dali errar aqui.
         */
        tokenAmount: porToken ? (dados.tokenAmount ?? null) : null,
        priceUsd: porToken ? (dados.priceUsd ?? null) : null,
        valueUsd: valorDoRecebimento(dados),
      })
      .where(
        and(
          eq(schema.airdropClaims.id, id),
          eq(schema.airdropClaims.userId, userId),
        ),
      );
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

export async function exigirAdministrador(userId: string) {
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
  }, [{ caminho: "/membros", tipo: "page" }]);
}

/** Devolve para a fila: serve tanto para revogar acesso quanto reconsiderar. */
export async function reabrirMembro(id: string): Promise<ResultadoAcao> {
  return executar(idSchema, { id }, async (dados, userId) => {
    await exigirAdministrador(userId);
    await db
      .update(schema.users)
      .set({ status: "pendente", reviewedAt: null, reviewNote: null })
      .where(and(eq(schema.users.id, dados.id), ne(schema.users.role, "admin")));
  }, [{ caminho: "/membros", tipo: "page" }]);
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
