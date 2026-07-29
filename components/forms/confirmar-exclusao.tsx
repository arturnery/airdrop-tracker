"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmação de exclusão.
 *
 * `impacto` descreve o que vai junto ("8 lançamentos e 2 tarefas") — dizer o
 * tamanho do estrago é mais útil que perguntar "tem certeza?", e é a única
 * defesa aqui, já que não existe desfazer por item.
 */
export function ConfirmarExclusao({
  titulo,
  alvo,
  impacto,
  aoConfirmar,
  gatilho,
}: {
  titulo: string;
  alvo: string;
  impacto?: string | null;
  aoConfirmar: () => void;
  gatilho: ReactNode;
}) {
  return (
    <AlertDialog>
      {/* AlertDialogTrigger com asChild: o gatilho continua sendo um <button>
          real, alcançável por Tab e acionável por Enter/Espaço. */}
      <AlertDialogTrigger asChild>{gatilho}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                <strong className="text-foreground font-medium">{alvo}</strong> será
                removido permanentemente.
              </p>
              {impacto ? (
                <p className="text-caution">
                  Isso também apaga {impacto}.
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={aoConfirmar}
            className={cn(
              buttonVariants({ variant: "destructive" }),
              "bg-destructive text-white hover:bg-destructive/90",
            )}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
