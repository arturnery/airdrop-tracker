"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";

import { sair } from "@/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Rodapé da barra lateral.
 *
 * Encerrar a sessão é operação de servidor: o cookie precisa ser invalidado
 * lá. Apagar o cookie no cliente deixaria o token continuar válido.
 */
export function Sair() {
  const [saindo, iniciar] = useTransition();

  return (
    <div className="border-border border-t p-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        disabled={saindo}
        onClick={() => iniciar(async () => { await sair(); })}
      >
        {saindo ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="size-4" aria-hidden="true" />
        )}
        Sair
      </Button>
    </div>
  );
}
