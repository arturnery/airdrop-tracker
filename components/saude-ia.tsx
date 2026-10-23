import { Activity, AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

import { formatarQuando } from "@/lib/lives";
import { cn } from "@/lib/utils";

export type LinhaDaSaude = {
  modelo: string;
  tarefas: string[];
  ultimoOk: string | null;
  ultimaFalha: string | null;
  tipoFalha: string | null;
  detalheFalha: string | null;
  falhasSeguidas: number;
};

/**
 * Quadro "Saúde das IAs", só para quem administra (ARCHITECTURE §18.9).
 *
 * Um modelo por linha, com as tarefas em que ele entra e o estado pela última
 * tentativa. Existe porque a disputa entre modelos esconde falha: um modelo
 * grátis sai do ar e os outros seguem respondendo, até a tarefa que dependia
 * só dele parar.
 */
function estado(l: LinhaDaSaude) {
  // Consultado, mas outro modelo sempre respondeu antes (quem perde a corrida
  // é cancelado e não conta), ou ainda não houve pedido para a tarefa dele.
  if (!l.ultimoOk && !l.ultimaFalha) return { rotulo: "Sem resultado registrado", tom: "neutro" as const, Icone: CircleDashed };
  if (l.falhasSeguidas === 0) return { rotulo: "Respondendo", tom: "ok" as const, Icone: CheckCircle2 };
  if (l.tipoFalha === "definitiva") return { rotulo: "Fora do ar", tom: "grave" as const, Icone: AlertTriangle };
  if (l.falhasSeguidas >= 3) return { rotulo: "Falhando", tom: "grave" as const, Icone: AlertTriangle };
  return { rotulo: "Instável", tom: "atencao" as const, Icone: Activity };
}

export function SaudeDasIAs({ linhas }: { linhas: LinhaDaSaude[] }) {
  if (linhas.length === 0) return null;
  const graves = linhas.filter((l) => estado(l).tom === "grave").length;
  return (
    <section aria-labelledby="saude-ia" className="bg-card border-border mb-8 rounded-lg border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="saude-ia" className="text-base font-medium">
          Saúde das IAs
        </h2>
        <p className={cn("text-xs", graves > 0 ? "text-caution font-medium" : "text-muted-foreground")}>
          {graves > 0
            ? `${graves} ${graves === 1 ? "modelo com problema" : "modelos com problema"}: veja abaixo`
            : "Pela última tentativa de cada modelo. Quem perde a corrida para outro modelo não conta."}
        </p>
      </div>
      <ul className="divide-border mt-3 divide-y">
        {linhas.map((l) => {
          const e = estado(l);
          return (
            <li key={l.modelo} className="grid gap-x-4 gap-y-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium" title={l.modelo}>
                  {l.modelo}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">{l.tarefas.join(" · ")}</p>
                {e.tom === "grave" || e.tom === "atencao" ? (
                  <p className="text-muted-foreground mt-1 text-xs [overflow-wrap:anywhere]">
                    {l.falhasSeguidas} {l.falhasSeguidas === 1 ? "falha seguida" : "falhas seguidas"}, a última{" "}
                    {l.ultimaFalha ? formatarQuando(l.ultimaFalha) : ""}: {l.detalheFalha}
                  </p>
                ) : null}
              </div>
              <div className="flex items-start gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium",
                    e.tom === "ok" && "text-brand-legivel",
                    e.tom === "grave" && "text-caution",
                    e.tom === "atencao" && "text-caution/80",
                    e.tom === "neutro" && "text-muted-foreground",
                  )}
                >
                  <e.Icone className="size-3.5" aria-hidden="true" />
                  {e.rotulo}
                </span>
                {l.ultimoOk ? <span className="text-muted-foreground text-[11px]">ok {formatarQuando(l.ultimoOk)}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {graves > 0 ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Modelo grátis sai do ar sem aviso. Peça a troca do modelo (as variáveis ficam na Vercel); enquanto isso, os
          outros modelos da mesma tarefa seguem respondendo.
        </p>
      ) : null}
    </section>
  );
}
