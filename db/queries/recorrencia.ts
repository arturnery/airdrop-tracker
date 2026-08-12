import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { contasAlvoDaTarefa } from "@/lib/tarefas";
import { datasDevidas, janelaPadrao, type Recorrencia } from "@/lib/recurrence";

/**
 * Cria as ocorrências que deveriam existir e ainda não existem.
 *
 * Roda na leitura, não num cron. A diferença que motivou a escolha é o modo de
 * falhar: um job que não roda numa noite deixa o dia seguinte sem tarefas, e
 * ninguém percebe que faltou. Aqui não há estado a perder, porque o que deveria
 * existir é recalculado toda vez.
 *
 * Reexecutar é seguro por construção: a constraint
 * `unique(task_id, account_id, due_date)` mais `ON CONFLICT DO NOTHING` fazem a
 * segunda passada não inserir nada. A garantia é do banco, não da lógica que
 * decide o que inserir.
 *
 * Só grava quando há algo faltando. Sem essa checagem, toda abertura de página
 * dispararia um INSERT, e ler uma tela não deveria custar uma escrita.
 */
export async function materializarOcorrencias(
  userId: string,
  hoje: string,
): Promise<void> {
  const janela = janelaPadrao(hoje);

  const tarefas = await db
    .select({
      id: schema.tasks.id,
      projectId: schema.tasks.projectId,
      accountId: schema.tasks.accountId,
      recurrence: schema.tasks.recurrence,
      intervalDays: schema.tasks.intervalDays,
      dueDate: schema.tasks.dueDate,
      createdAt: schema.tasks.createdAt,
    })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.isActive, true)));

  if (tarefas.length === 0) return;

  /*
   * Tarefa de prazo fixo não recorre: a ocorrência dela nasce junto com a
   * tarefa e não deve ser recriada se a pessoa apagou a ocorrência de
   * propósito.
   */
  const recorrentes = tarefas.filter((t) => t.recurrence !== "none");
  if (recorrentes.length === 0) return;

  const [vinculos, contasDoUsuario, existentes] = await Promise.all([
    db
      .select({
        projectId: schema.projectAccounts.projectId,
        accountId: schema.projectAccounts.accountId,
      })
      .from(schema.projectAccounts),
    db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId)),
    db
      .select({
        taskId: schema.taskOccurrences.taskId,
        accountId: schema.taskOccurrences.accountId,
        dueDate: schema.taskOccurrences.dueDate,
      })
      .from(schema.taskOccurrences)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskOccurrences.taskId))
      .where(eq(schema.tasks.userId, userId)),
  ]);

  const jaExiste = new Set(
    existentes.map((o) => `${o.taskId}|${o.accountId}|${o.dueDate}`),
  );
  const idsDoUsuario = contasDoUsuario.map((c) => c.id);

  const novas: { taskId: string; accountId: string; dueDate: string }[] = [];

  for (const tarefa of recorrentes) {
    const contas = contasAlvoDaTarefa(
      tarefa.accountId,
      vinculos
        .filter((v) => v.projectId === tarefa.projectId)
        .map((v) => v.accountId),
      idsDoUsuario,
    );
    if (contas.length === 0) continue;

    /*
     * A âncora define o dia da semana da regra semanal e o dia do mês da
     * mensal. `dueDate` é a data que a pessoa escolheu ao criar; sem ela, a
     * data de criação da tarefa serve de referência.
     */
    const ancora = tarefa.dueDate ?? tarefa.createdAt.toISOString().slice(0, 10);

    const datas = datasDevidas(
      {
        recorrencia: tarefa.recurrence as Recorrencia,
        intervaloDias: tarefa.intervalDays,
        ancora,
      },
      janela,
    );

    for (const dueDate of datas) {
      for (const accountId of contas) {
        if (jaExiste.has(`${tarefa.id}|${accountId}|${dueDate}`)) continue;
        novas.push({ taskId: tarefa.id, accountId, dueDate });
      }
    }
  }

  if (novas.length === 0) return;

  await db.insert(schema.taskOccurrences).values(novas).onConflictDoNothing();
}
