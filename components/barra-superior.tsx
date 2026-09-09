"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { paginaAtual } from "@/lib/paginas";

/**
 * Faixa fixa acima do conteúdo, com o nome da página e um sino.
 *
 * O sino ainda não faz nada. Existe como o começo de uma central de
 * notificações que a barra lateral, o sino de novidades e este ícone vão
 * dividir — decidido em conversa, ainda não desenhado. Fica visível desde já
 * para o lugar dele já existir na tela quando a funcionalidade chegar.
 */
export function BarraSuperior() {
  const pathname = usePathname();
  const pagina = paginaAtual(pathname);

  return (
    <div className="border-border bg-sidebar/60 sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3 backdrop-blur-sm lg:px-10">
      <span className="text-sm font-medium">{pagina?.rotulo ?? "Level Cripto"}</span>
      <button
        type="button"
        aria-label="Notificações"
        title="Notificações (em breve)"
        className="text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Bell className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
