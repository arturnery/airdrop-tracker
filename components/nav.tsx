"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDollarSign,
  History,
  UserCheck,
  LayoutDashboard,
  Layers,
  ListChecks,
  Upload,
  Wallet,
} from "lucide-react";

import { useDados } from "@/components/data-provider";
import { selectPendingTasks } from "@/lib/selectors";
import { cn } from "@/lib/utils";

const itens = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/projetos", label: "Projetos", icon: Layers },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/cotacoes", label: "Cotações", icon: CircleDollarSign },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/membros", label: "Membros", icon: UserCheck },
] as const;

export function Nav() {
  const pathname = usePathname();
  const { dataset, hoje } = useDados();

  const urgentes = selectPendingTasks(dataset, hoje).filter(
    (t) => t.urgencia === "atrasada" || t.urgencia === "hoje",
  ).length;
  // A contagem de membros pendentes não entra aqui: ela vive em `users` e é
  // dado de administração, que não deve ser carregado em toda navegação.
  const contagem = (href: string) => (href === "/tarefas" ? urgentes : 0);

  const estaAtivo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav aria-label="Navegação principal" className="p-3">
      <ul className="flex gap-1 lg:flex-col">
        {itens.map((item) => {
          const ativo = estaAtivo(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1 lg:flex-none">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors lg:justify-start",
                  "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  ativo
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
                {contagem(item.href) > 0 ? (
                  <span className="bg-caution/15 text-caution tabular ml-auto hidden rounded px-1.5 py-0.5 text-xs font-medium lg:inline">
                    {contagem(item.href)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
