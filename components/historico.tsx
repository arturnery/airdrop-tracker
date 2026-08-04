"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Fuel,
  Gift,
  Repeat,
  Sprout,
  TrendingUp,
} from "lucide-react";

import { Money } from "@/components/money";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AtividadeRow, TipoAtividade } from "@/lib/types";

/**
 * Feed de atividade.
 *
 * O ícone nunca é o único identificador do evento: cada linha traz o rótulo
 * escrito ("Depósito", "Saldo atualizado"), então quem não distingue os
 * símbolos continua lendo o histórico normalmente.
 */

const icones: Record<TipoAtividade, typeof ArrowDownLeft> = {
  deposito: ArrowDownLeft,
  retirada: ArrowUpRight,
  trade: TrendingUp,
  rendimento: Sprout,
  taxa: Fuel,
  volume: Repeat,
  recebimento: Gift,
  tarefa: Check,
};

const coresIcone: Record<TipoAtividade, string> = {
  deposito: "text-primary bg-primary/10",
  retirada: "text-caution bg-caution/10",
  trade: "text-muted-foreground bg-secondary",
  rendimento: "text-positive bg-positive/10",
  taxa: "text-negative bg-negative/10",
  volume: "text-muted-foreground bg-secondary",
  recebimento: "text-positive bg-positive/10",
  tarefa: "text-positive bg-positive/10",
};

/** Volume operado não é caixa: aparece apagado para não parecer aporte. */
const valorApagado = new Set<TipoAtividade>(["volume"]);

export function LinhaAtividade({
  item,
  hoje,
  mostrarData = false,
}: {
  item: AtividadeRow;
  hoje: string;
  mostrarData?: boolean;
}) {
  const Icone = icones[item.tipo];

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          coresIcone[item.tipo],
        )}
        aria-hidden="true"
      >
        <Icone className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{item.titulo}</span>
          {item.detalhe ? (
            <span className="text-muted-foreground"> · {item.detalhe}</span>
          ) : null}
        </p>
        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          <Link
            href={`/projetos/${item.projetoSlug}`}
            className="hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {item.projetoNome}
          </Link>
          <span aria-hidden="true">·</span>
          <span>{item.contaLabel}</span>
          {mostrarData ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatDateBr(item.data)}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        {item.valor !== null ? (
          <Money
            value={item.valor}
            tone={valorApagado.has(item.tipo) ? "muted" : "auto"}
            signed={!valorApagado.has(item.tipo)}
            className="text-sm"
          />
        ) : null}
        <span className="text-muted-foreground text-xs">
          {relativeLabel(item.data, hoje)}
        </span>
      </div>
    </li>
  );
}

export function ListaAtividade({
  itens,
  hoje,
  mostrarData = true,
}: {
  itens: AtividadeRow[];
  hoje: string;
  mostrarData?: boolean;
}) {
  return (
    <ul className="border-border divide-border divide-y rounded-lg border">
      {itens.map((item) => (
        <LinhaAtividade
          key={item.id}
          item={item}
          hoje={hoje}
          mostrarData={mostrarData}
        />
      ))}
    </ul>
  );
}
