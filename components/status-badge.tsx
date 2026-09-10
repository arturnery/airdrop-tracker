import { cn } from "@/lib/utils";
import type {
  ProjectAccountStatus,
  ProjectCategory,
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
  descartado: "border-border text-muted-foreground",
};

/**
 * O risco pertence ao nome do projeto, não ao rótulo do status: riscar a
 * palavra "Descartado" apenas tornava o próprio rótulo difícil de ler.
 */
export const nomeRiscado = (status: ProjectStatus) =>
  status === "descartado" ? "line-through decoration-muted-foreground/60" : "";

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

/**
 * Escala de 1 a 3: baixa, média, alta, com três barras crescentes ao lado do
 * nome (a barra sozinha já tinha sido tentada, sem nome nos níveis, e cinco
 * barras iguais não diziam qual delas importava mais; o nome resolve isso,
 * a barra dá o reconhecimento rápido por forma, sem precisar ler).
 *
 * A cor cresce com o nível de propósito: baixa não pede atenção (cinza),
 * média usa o âmbar de atenção do sistema, e alta usa o vermelho de urgência,
 * o mesmo de tarefa atrasada. Não é a cor de ganho/perda financeiro (verde):
 * prioridade não é resultado, e verde aqui sugeriria que baixa é "boa".
 */
export const priorityLabels: Record<number, string> = {
  1: "Baixa",
  2: "Média",
  3: "Alta",
};

const priorityStyles: Record<number, string> = {
  1: "border-border text-muted-foreground",
  2: "border-caution/40 bg-caution/10 text-caution",
  3: "border-negative/40 bg-negative/10 text-negative font-semibold",
};

const priorityBarColor: Record<number, string> = {
  1: "bg-muted-foreground",
  2: "bg-caution",
  3: "bg-negative",
};

/** As três barras crescentes, decorativas: o texto ao lado já diz o nível. */
function BarrasPrioridade({ value }: { value: number }) {
  const cor = priorityBarColor[value] ?? priorityBarColor[2];
  return (
    <span aria-hidden="true" className="flex items-end gap-0.5">
      {[1, 2, 3].map((barra) => (
        <span
          key={barra}
          className={cn(
            "w-1 rounded-xs",
            barra === 1 ? "h-1.5" : barra === 2 ? "h-2.5" : "h-3.5",
            barra <= value ? cor : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

export function PriorityBadge({ value }: { value: number }) {
  const rotulo = priorityLabels[value] ?? String(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        priorityStyles[value] ?? priorityStyles[2],
      )}
      title={`Prioridade ${rotulo.toLowerCase()}`}
    >
      <BarrasPrioridade value={value} />
      {rotulo}
    </span>
  );
}

const categoryLabels: Record<ProjectCategory, string> = {
  liquidez: "Liquidez",
  interacoes: "Interações",
  perps: "Perps",
};

/** Descrição longa, usada em tooltip e nos formulários. */
export const categoryDescriptions: Record<ProjectCategory, string> = {
  liquidez: "Farm passivo: capital parado rendendo",
  interacoes: "Interações semanais: exige rotina de uso",
  perps: "Perps: volume operado é o que conta",
};

const categoryStyles: Record<ProjectCategory, string> = {
  liquidez: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  interacoes: "border-chart-3/40 text-chart-3 bg-chart-3/10",
  perps: "border-chart-4/40 text-chart-4 bg-chart-4/10",
};

export function CategoryBadge({ category }: { category: ProjectCategory | null }) {
  if (!category) {
    return (
      <span className="text-muted-foreground border-border inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-xs">
        sem categoria
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        categoryStyles[category],
      )}
      title={categoryDescriptions[category]}
    >
      {categoryLabels[category]}
    </span>
  );
}

export { categoryLabels };
