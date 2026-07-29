import { cn } from "@/lib/utils";
import type {
  ProjectAccountStatus,
  ProjectStatus,
  Recurrence,
  TaskUrgency,
} from "@/lib/types";

const projectLabels: Record<ProjectStatus, string> = {
  pesquisando: "Pesquisando",
  ativo: "Ativo",
  pausado: "Pausado",
  tge_anunciado: "TGE anunciado",
  distribuido: "Distribuído",
  descartado: "Descartado",
};

const projectStyles: Record<ProjectStatus, string> = {
  pesquisando: "border-border text-muted-foreground",
  ativo: "border-positive/40 text-positive bg-positive/10",
  pausado: "border-caution/40 text-caution bg-caution/10",
  tge_anunciado: "border-caution/40 text-caution bg-caution/10",
  distribuido: "border-primary/40 text-primary bg-primary/10",
  descartado: "border-border text-muted-foreground line-through",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        projectStyles[status],
      )}
    >
      {projectLabels[status]}
    </span>
  );
}

const accountLabels: Record<ProjectAccountStatus, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  queimada: "Queimada",
};

const accountStyles: Record<ProjectAccountStatus, string> = {
  ativa: "border-positive/40 text-positive bg-positive/10",
  pausada: "border-caution/40 text-caution bg-caution/10",
  queimada: "border-negative/40 text-negative bg-negative/10",
};

export function AccountStatusBadge({ status }: { status: ProjectAccountStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        accountStyles[status],
      )}
    >
      {accountLabels[status]}
    </span>
  );
}

const urgencyLabels: Record<TaskUrgency, string> = {
  atrasada: "Atrasada",
  hoje: "Hoje",
  proxima: "Próxima",
};

const urgencyStyles: Record<TaskUrgency, string> = {
  atrasada: "border-negative/40 text-negative bg-negative/10",
  hoje: "border-caution/40 text-caution bg-caution/10",
  proxima: "border-border text-muted-foreground",
};

export function UrgencyBadge({ urgency }: { urgency: TaskUrgency }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        urgencyStyles[urgency],
      )}
    >
      {urgencyLabels[urgency]}
    </span>
  );
}

const recurrenceLabels: Record<Recurrence, string> = {
  none: "Prazo fixo",
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  every_n_days: "Periódica",
};

export function RecurrenceLabel({ recurrence }: { recurrence: Recurrence }) {
  return (
    <span className="text-muted-foreground text-xs">
      {recurrenceLabels[recurrence]}
    </span>
  );
}

/** Prioridade 1–5 como barras. O número acompanha para não depender da forma. */
export function PriorityMeter({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`Prioridade ${value} de 5`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn(
              "h-3 w-1 rounded-full",
              n <= value ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </span>
      <span className="sr-only">Prioridade {value} de 5</span>
    </span>
  );
}
