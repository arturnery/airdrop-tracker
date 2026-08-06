"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Rodapé da barra lateral.
 *
 * O botão de restaurar dados saiu com a entrada do banco: ele existia para
 * descartar o que estava no localStorage, e não faz sentido oferecer "apagar
 * tudo" agora que os dados são persistentes e de verdade.
 */
export function RestaurarDados() {
  return (
    <div className="border-border border-t p-3">
      <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
        <Link href="/entrar">
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </Link>
      </Button>
    </div>
  );
}
