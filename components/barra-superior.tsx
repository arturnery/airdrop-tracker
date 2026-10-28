"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { paginaAtual } from "@/lib/paginas";

/**
 * Faixa fixa acima do conteúdo, com o nome da página e um sino.
 *
 * Por enquanto o sino avisa uma coisa só, e só a quem administra: cadastros
 * e pedidos de senha esperando na tela de membros. Com algo esperando, ele
 * ganha o número e leva até lá. Sem nada, continua no lugar, apagado, como o
 * começo da central de notificações que ainda vai juntar os outros avisos.
 */
export function BarraSuperior({ membrosPendentes = 0 }: { membrosPendentes?: number }) {
  const pathname = usePathname();
  const pagina = paginaAtual(pathname);
  const estilo =
    "relative rounded-md p-1.5 transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="border-border bg-sidebar/60 sticky top-0 z-30 flex items-center justify-between border-b px-6 py-3 backdrop-blur-sm lg:px-10">
      <span className="text-sm font-medium">{pagina?.rotulo ?? "Level Cripto"}</span>
      {membrosPendentes > 0 ? (
        <Link
          href="/membros"
          aria-label={`Notificações: ${membrosPendentes} ${membrosPendentes === 1 ? "pendência" : "pendências"} em Membros`}
          title={`${membrosPendentes} ${membrosPendentes === 1 ? "cadastro ou pedido esperando" : "cadastros ou pedidos esperando"} em Membros`}
          className={`${estilo} text-caution hover:bg-sidebar-accent/50`}
        >
          <Bell className="size-4" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="bg-caution text-background tabular absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold"
          >
            {membrosPendentes > 9 ? "9+" : membrosPendentes}
          </span>
        </Link>
      ) : (
        <button
          type="button"
          aria-label="Notificações"
          title="Nenhuma notificação"
          className={`${estilo} text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground`}
        >
          <Bell className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
