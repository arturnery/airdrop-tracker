"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  UserCheck,
  LayoutDashboard,
  Layers,
  LifeBuoy,
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
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/importar", label: "Importar", icon: Upload },
] as const;

/**
 * Um tom fixo por item, para a bolha atrás do ícone.
 *
 * Não é cor de estado (essa continua reservada a ganho/perda/atenção): é a
 * mesma paleta categórica que os gráficos já usam, aqui emprestada como
 * identidade visual de "qual lugar é este", para reencontrar o item pela
 * mancha de cor, sem ler o texto. Fixo por rota, e não sorteado: o mesmo
 * item precisa ter sempre a mesma cor entre uma sessão e outra.
 */
const tons: Record<string, string> = {
  "/": "bg-chart-1/15 text-chart-1",
  "/tarefas": "bg-chart-4/15 text-chart-4",
  "/projetos": "bg-chart-3/15 text-chart-3",
  "/contas": "bg-chart-2/15 text-chart-2",
  "/historico": "bg-brand/15 text-brand-legivel",
  "/importar": "bg-chart-1/15 text-chart-1",
  "/membros": "bg-chart-4/15 text-chart-4",
  "/suporte": "bg-chart-3/15 text-chart-3",
};

/**
 * `ehAdmin` esconde o item de administração de quem não é: conforto visual,
 * não segurança. A rota se protege sozinha no servidor (§9.4).
 */
export function Nav({
  ehAdmin = false,
  feedbackNaoLido = 0,
  recolhida = false,
}: {
  ehAdmin?: boolean;
  /** Só chega preenchido para quem administra: ver o layout. */
  feedbackNaoLido?: number;
  /** Barra estreita: sobram os ícones, os rótulos viram texto acessível. */
  recolhida?: boolean;
}) {
  const pathname = usePathname();
  const { dataset, hoje } = useDados();

  const urgentes = selectPendingTasks(dataset, hoje).filter(
    (t) => t.urgencia === "atrasada" || t.urgencia === "hoje",
  ).length;
  // A contagem de membros pendentes não entra aqui: ela vive em `users` e é
  // dado de administração, que não deve ser carregado em toda navegação.
  const contagem = (href: string) =>
    href === "/tarefas"
      ? urgentes
      : href === "/suporte"
        ? feedbackNaoLido
        : 0;

  const estaAtivo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav aria-label="Navegação principal" className="p-3">
      <ul className="flex gap-1 lg:flex-col">
        {[
          ...itens,
          ...(ehAdmin
            ? ([
                { href: "/membros", label: "Membros", icon: UserCheck },
                { href: "/suporte", label: "Suporte", icon: LifeBuoy },
              ] as const)
            : []),
        ].map((item) => {
          const ativo = estaAtivo(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1 lg:flex-none">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                title={recolhida ? item.label : undefined}
                className={cn(
                  "relative flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors lg:justify-start",
                  recolhida && "lg:justify-center lg:px-0",
                  "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  ativo
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    tons[item.href] ?? "bg-secondary text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {/* Recolhida, o rótulo sai da tela e permanece no DOM: leitor
                    de tela e busca da página continuam encontrando a palavra. */}
                <span
                  className={cn(
                    "hidden sm:inline",
                    recolhida && "lg:sr-only",
                  )}
                >
                  {item.label}
                </span>
                {contagem(item.href) > 0 ? (
                  /* Recolhida, o número vira um ponto: dizer "3" em 68px
                     empurraria o ícone, e o que importa ali é saber que há
                     algo esperando. */
                  recolhida ? (
                    <span
                      aria-label={`${contagem(item.href)} pendente(s)`}
                      className="bg-caution absolute top-1.5 right-1.5 hidden size-1.5 rounded-full lg:block"
                    />
                  ) : (
                    <span className="bg-caution/15 text-caution tabular ml-auto hidden rounded px-1.5 py-0.5 text-xs font-medium lg:inline">
                      {contagem(item.href)}
                    </span>
                  )
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
