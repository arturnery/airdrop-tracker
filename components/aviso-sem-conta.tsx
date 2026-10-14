"use client";

import Link from "next/link";
import { Link2Off } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { VincularConta } from "@/components/forms/dialogs";
import { cn } from "@/lib/utils";

/**
 * Projeto sem nenhuma conta vinculada.
 *
 * Todo projeto precisa de pelo menos uma: é a conta que recebe lançamentos,
 * tarefas, pontos e recebimentos, e sem ela o projeto não tem como ser
 * acompanhado. Até aqui o vínculo só nascia no primeiro lançamento, e um
 * projeto recém-cadastrado ficava vazio sem dizer por quê.
 *
 * Âmbar, a cor de "olhe isto", como o aviso de saldo: não é prejuízo, é algo
 * faltando.
 */

/** Versão do card: uma linha, na mesma altura do "Resultado". */
export function AvisoSemContaCompacto() {
  return (
    <p className="border-caution/40 bg-caution/10 flex h-10 items-center gap-2 rounded-md border px-3 text-xs">
      <Link2Off className="text-caution size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-foreground/90 truncate">Nenhuma conta vinculada a este projeto</span>
    </p>
  );
}

/**
 * Versão da página do projeto, com a ação que resolve. Sem nenhuma conta
 * cadastrada, "Vincular conta" abriria um formulário sem opções; aí o
 * caminho é cadastrar a primeira em Contas.
 */
export function AvisoSemConta({ projectId, className }: { projectId: string; className?: string }) {
  const { dataset } = useDados();
  const temContas = dataset.accounts.length > 0;

  return (
    <div
      role="status"
      className={cn(
        "border-caution/40 bg-caution/10 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-sm">
        <Link2Off className="text-caution mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-medium">Este projeto não tem nenhuma conta vinculada.</strong>{" "}
          <span className="text-foreground/80">
            Todo projeto precisa de pelo menos uma: é ela que recebe os lançamentos, as tarefas e os
            pontos.
          </span>
        </span>
      </p>
      {temContas ? (
        <VincularConta projectId={projectId} />
      ) : (
        <Link
          href="/contas"
          className="border-border bg-background hover:bg-muted focus-visible:ring-ring inline-flex shrink-0 items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Cadastrar uma conta
        </Link>
      )}
    </div>
  );
}
