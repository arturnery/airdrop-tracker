"use client";

import Link from "next/link";
import { Check, Trash2, Undo2 } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { NovaTarefa } from "@/components/forms/dialogs";
import { EditarTarefa } from "@/components/forms/editar";
import { EmptyState, PageHeader } from "@/components/page-header";
import { RecurrenceLabel, UrgencyBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { selectCompletedToday, selectPendingTasks } from "@/lib/selectors";
import type { TaskOccurrenceRow, TaskUrgency } from "@/lib/types";

const secoes: { chave: TaskUrgency; titulo: string }[] = [
  { chave: "atrasada", titulo: "Atrasadas" },
  { chave: "hoje", titulo: "Para hoje" },
  { chave: "proxima", titulo: "Próximas" },
];

function Lista({
  tarefas,
  hoje,
  aoConcluir,
  aoExcluir,
  contarOcorrencias,
}: {
  tarefas: TaskOccurrenceRow[];
  hoje: string;
  aoConcluir: (id: string) => void;
  aoExcluir: (taskId: string) => void;
  contarOcorrencias: (taskId: string) => number;
}) {
  return (
    <ul className="border-border divide-border divide-y rounded-lg border">
      {tarefas.map((tarefa) => (
        <li key={tarefa.id} className="flex items-start gap-3 px-4 py-3">
          <Checkbox
            id={`tarefa-${tarefa.id}`}
            checked={false}
            onCheckedChange={() => aoConcluir(tarefa.id)}
            className="mt-0.5"
            aria-label={`Concluir: ${tarefa.titulo} — ${tarefa.projetoNome}, ${tarefa.contaLabel}`}
          />
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`tarefa-${tarefa.id}`}
              className="cursor-pointer text-sm font-medium"
            >
              {tarefa.titulo}
            </label>
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
          <div className="flex shrink-0 items-start gap-2">
            <div className="flex flex-col items-end gap-1.5">
              <UrgencyBadge urgency={tarefa.urgencia} />
              <span className="text-muted-foreground tabular text-xs">
                {formatDateBr(tarefa.vencimento)}
              </span>
              <span className="text-muted-foreground text-xs">
                {relativeLabel(tarefa.vencimento, hoje)}
              </span>
            </div>
            <div className="flex items-center">
              <EditarTarefa taskId={tarefa.taskId} />
              <ConfirmarExclusao
                titulo="Excluir tarefa"
                alvo={tarefa.titulo}
                impacto={(() => {
                  const n = contarOcorrencias(tarefa.taskId);
                  return n > 1
                    ? `${n} ocorrências dessa tarefa, em todas as contas`
                    : null;
                })()}
                aoConfirmar={() => aoExcluir(tarefa.taskId)}
                gatilho={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-negative size-8"
                    aria-label={`Excluir ${tarefa.titulo}`}
                    title={`Excluir ${tarefa.titulo}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                }
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TarefasView() {
  const { dataset, hoje, acoes } = useDados();

  const pendentes = selectPendingTasks(dataset, hoje);
  const concluidas = selectCompletedToday(dataset, hoje);

  const porUrgencia = (chave: TaskUrgency) =>
    pendentes.filter((t) => t.urgencia === chave);

  const totalUrgente = porUrgencia("atrasada").length + porUrgencia("hoje").length;

  return (
    <>
      <PageHeader
        title="Tarefas"
        description={
          totalUrgente === 0
            ? `Nada exigindo atenção em ${formatDateBr(hoje)}.`
            : `${totalUrgente} ${totalUrgente === 1 ? "tarefa exige" : "tarefas exigem"} atenção em ${formatDateBr(hoje)}.`
        }
        actions={<NovaTarefa />}
      />

      {pendentes.length === 0 ? (
        <EmptyState
          title="Nenhuma tarefa pendente"
          description="Cadastre tarefas recorrentes (check-in diário, volume semanal) ou com prazo fixo. Elas aparecem aqui expandidas por conta."
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
                  <span className="text-muted-foreground tabular text-xs">
                    {lista.length}
                  </span>
                </h2>
                <Lista
                  tarefas={lista}
                  hoje={hoje}
                  aoConcluir={acoes.alternarTarefa}
                  aoExcluir={acoes.excluirTarefa}
                  contarOcorrencias={(taskId) =>
                    dataset.taskOccurrences.filter((o) => o.taskId === taskId).length
                  }
                />
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
            <span className="tabular text-xs">{concluidas.length}</span>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7"
                  onClick={() => acoes.alternarTarefa(tarefa.id)}
                >
                  <Undo2 className="size-3.5" aria-hidden="true" />
                  Reabrir
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
