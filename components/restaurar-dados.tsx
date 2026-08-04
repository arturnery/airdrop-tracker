"use client";

import Link from "next/link";
import { LogOut, RotateCcw } from "lucide-react";

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

  return (
    <div className="border-border border-t p-3">
      <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
        <Link href="/entrar">
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </Link>
      </Button>
      {modificado ? <SecaoRestaurar aoRestaurar={acoes.restaurarOriginal} /> : null}
    </div>
  );
}

function SecaoRestaurar({ aoRestaurar }: { aoRestaurar: () => void }) {
  return (
    <div className="border-border mt-3 border-t pt-3">
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
            aoRestaurar();
          }
        }}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Restaurar dados originais
      </Button>
    </div>
  );
}
