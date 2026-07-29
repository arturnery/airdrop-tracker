import Link from "next/link";
import { Check } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/page-header";
import { RecurrenceLabel, UrgencyBadge } from "@/components/status-badge";
import { HOJE } from "@/db/queries/fixtures";
import { listCompletedToday, listPendingTasks } from "@/db/queries/tasks";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import type { TaskOccurrenceRow, TaskUrgency } from "@/lib/types";

export const metadata = { title: "Tarefas · airdrop-tracker" };

const secoes: { chave: TaskUrgency; titulo: string; vazio: string }[] = [
  {
    chave: "atrasada",
    titulo: "Atrasadas",
    vazio: "Nada atrasado.",
  },
  {
    chave: "hoje",
    titulo: "Para hoje",
    vazio: "Nada pendente para hoje.",
  },
  {
    chave: "proxima",
    titulo: "Próximas",
    vazio: "Nada agendado à frente.",
  },
];

function ListaDeTarefas({ tarefas }: { tarefas: TaskOccurrenceRow[] }) {
  return (
    <ul className="border-border divide-border divide-y rounded-lg border">
      {tarefas.map((tarefa) => (
        <li key={tarefa.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{tarefa.titulo}</p>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <Link
                href={`/projetos/${tarefa.projetoSlug}`}
                className="hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {tarefa.projetoNome}
              </Link>
              <span aria-hidden="true">·</span>
              <span>{tarefa.contaLabel}</span>
              <span aria-hidden="true">·</span>
              <RecurrenceLabel recurrence={tarefa.recorrencia} />
            </p>
            {tarefa.descricao ? (
              <p className="text-muted-foreground mt-1 text-xs">{tarefa.descricao}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <UrgencyBadge urgency={tarefa.urgencia} />
            <span className="text-muted-foreground text-xs tabular">
              {formatDateBr(tarefa.vencimento)}
            </span>
            <span className="text-muted-foreground text-xs">
              {relativeLabel(tarefa.vencimento, HOJE)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function TarefasPage() {
  const [pendentes, concluidas] = await Promise.all([
    listPendingTasks(),
    listCompletedToday(),
  ]);

  const porUrgencia = (chave: TaskUrgency) =>
    pendentes.filter((t) => t.urgencia === chave);

  const totalUrgente =
    porUrgencia("atrasada").length + porUrgencia("hoje").length;

  return (
    <>
      <PageHeader
        title="Tarefas"
        description={
          totalUrgente === 0
            ? `Nada exigindo atenção em ${formatDateBr(HOJE)}.`
            : `${totalUrgente} ${totalUrgente === 1 ? "tarefa exige" : "tarefas exigem"} atenção em ${formatDateBr(HOJE)}.`
        }
      />

      {pendentes.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa pendente"
          description="Cadastre tarefas recorrentes (check-in diário, volume semanal) ou com prazo fixo nos projetos. Elas aparecem aqui expandidas por conta."
        />
      ) : (
        <div className="space-y-8">
          {secoes.map((secao) => {
            const lista = porUrgencia(secao.chave);
            if (lista.length === 0) return null;
            return (
              <section key={secao.chave} aria-labelledby={`secao-${secao.chave}`}>
                <h2
                  id={`secao-${secao.chave}`}
                  className="mb-3 flex items-baseline gap-2 text-sm font-medium"
                >
                  {secao.titulo}
                  <span className="text-muted-foreground text-xs tabular">
                    {lista.length}
                  </span>
                </h2>
                <ListaDeTarefas tarefas={lista} />
              </section>
            );
          })}
        </div>
      )}

      {concluidas.length > 0 ? (
        <section aria-labelledby="secao-concluidas" className="mt-10">
          <h2
            id="secao-concluidas"
            className="text-muted-foreground mb-3 flex items-baseline gap-2 text-sm font-medium"
          >
            Concluídas hoje
            <span className="text-xs tabular">{concluidas.length}</span>
          </h2>
          <ul className="border-border divide-border divide-y rounded-lg border">
            {concluidas.map((tarefa) => (
              <li
                key={tarefa.id}
                className="text-muted-foreground flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <Check className="text-positive size-4 shrink-0" aria-hidden="true" />
                <span className="line-through">{tarefa.titulo}</span>
                <span className="text-xs">
                  {tarefa.projetoNome} · {tarefa.contaLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
