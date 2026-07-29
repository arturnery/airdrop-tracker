"use client";

import { RotateCcw } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { Button } from "@/components/ui/button";

/**
 * Volta o estado local para as fixtures originais.
 *
 * Só aparece quando existe alteração salva — sem isso o botão seria um convite
 * a apagar dados sem nada para desfazer.
 */
export function RestaurarDados() {
  const { modificado, acoes } = useDados();
  if (!modificado) return null;

  return (
    <div className="border-border border-t p-3">
      <p className="text-muted-foreground mb-2 px-1 text-xs">
        Alterações salvas neste navegador.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => {
          if (
            window.confirm(
              "Descartar tudo que você cadastrou e voltar aos dados originais?",
            )
          ) {
            acoes.restaurarOriginal();
          }
        }}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Restaurar dados originais
      </Button>
    </div>
  );
}
