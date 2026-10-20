"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  History,
  UserCheck,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  ListChecks,
  CalendarDays,
  Upload,
  Wallet,
} from "lucide-react";

import { useDados } from "@/components/data-provider";
import { selectPendingTasks } from "@/lib/selectors";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof LayoutDashboard };

/**
 * O menu é dividido em áreas que não se misturam: o que é a carteira de cada
 * um (Airdrops) e o que é da comunidade, igual para todos. Uma área nova (um
 * dia, Trade) entra como um grupo a mais, sem mexer nos outros.
 */
const grupos: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Airdrops",
    itens: [
      { href: "/", label: "Visão geral", icon: LayoutDashboard },
      { href: "/tarefas", label: "Tarefas", icon: ListChecks },
      { href: "/projetos", label: "Projetos", icon: Layers },
      { href: "/contas", label: "Contas", icon: Wallet },
      { href: "/historico", label: "Histórico", icon: History },
      { href: "/importar", label: "Importar", icon: Upload },
    ],
  },
  {
    titulo: "Comunidade",
    itens: [{ href: "/comunidade/calendario", label: "Calendário", icon: CalendarDays }],
  },
];

/*
 * Quais grupos cada pessoa deixou recolhidos, guardado no próprio navegador:
 * é conforto de tela, não dado, e não precisa ir ao banco nem seguir a
 * pessoa para outro aparelho.
 *
 * `useSyncExternalStore`, e não um estado lido num efeito: o servidor não
 * conhece o `localStorage`, então renderiza tudo aberto
 * (`getServerSnapshot`), e o navegador troca para o que estiver guardado logo
 * depois, sem divergência de hidratação. O acesso fica em try/catch porque o
 * armazenamento pode estar bloqueado (aba anônima, cookies desligados), e aí
 * o menu simplesmente fica todo aberto.
 */
const CHAVE_RECOLHIDOS = "menu-grupos-recolhidos";
const EVENTO_RECOLHIDOS = "menu-grupos-recolhidos-mudou";

function lerRecolhidos(): string {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDOS) ?? "[]";
  } catch {
    return "[]";
  }
}

function assinarRecolhidos(avisar: () => void) {
  window.addEventListener(EVENTO_RECOLHIDOS, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_RECOLHIDOS, avisar);
    window.removeEventListener("storage", avisar);
  };
}

function alternarRecolhido(titulo: string, atuais: string[]) {
  const novos = atuais.includes(titulo)
    ? atuais.filter((t) => t !== titulo)
    : [...atuais, titulo];
  try {
    localStorage.setItem(CHAVE_RECOLHIDOS, JSON.stringify(novos));
  } catch {
    // Sem armazenamento, a escolha vale só até recarregar: não há o que fazer.
  }
  window.dispatchEvent(new Event(EVENTO_RECOLHIDOS));
}

function lerLista(bruto: string): string[] {
  try {
    const valor: unknown = JSON.parse(bruto);
    return Array.isArray(valor) ? valor.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

const grupoAdministracao = {
  titulo: "Administração",
  itens: [
    { href: "/membros", label: "Membros", icon: UserCheck },
    { href: "/suporte", label: "Suporte", icon: LifeBuoy },
  ],
};

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
  "/comunidade/calendario": "bg-chart-5/15 text-chart-5",
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
    href === "/tarefas" ? urgentes : href === "/suporte" ? feedbackNaoLido : 0;

  const estaAtivo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const visiveis = ehAdmin ? [...grupos, grupoAdministracao] : grupos;
  const recolhidos = lerLista(useSyncExternalStore(assinarRecolhidos, lerRecolhidos, () => "[]"));

  /*
   * No celular o menu é uma fileira de ícones, sem espaço para títulos: os
   * grupos se desfazem (`contents`) e os itens ficam lado a lado. Na barra
   * lateral, cada grupo ganha o seu título; recolhida, o título vira uma linha
   * divisória, que ainda separa as áreas sem ocupar largura.
   */
  return (
    <nav aria-label="Navegação principal" className="p-3">
      <div className="flex gap-1 lg:flex-col lg:gap-4">
        {visiveis.map((grupo, indiceGrupo) => (
          <div key={grupo.titulo} className="contents lg:block">
            {/*
              O título é um botão que recolhe o grupo. Some na barra estreita
              (vira só a linha divisória) e no celular, que não têm títulos;
              nesses dois casos os itens aparecem sempre.
            */}
            <button
              type="button"
              id={`menu-${grupo.titulo}`}
              aria-expanded={!recolhidos.includes(grupo.titulo)}
              aria-controls={`itens-${grupo.titulo}`}
              onClick={() => alternarRecolhido(grupo.titulo, recolhidos)}
              title={recolhidos.includes(grupo.titulo) ? `Expandir ${grupo.titulo}` : `Recolher ${grupo.titulo}`}
              className={cn(
                "text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-1 hidden w-full items-center justify-between rounded-sm px-3 text-[11px] font-medium tracking-wider uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none lg:flex",
                recolhida && "lg:sr-only",
              )}
            >
              {grupo.titulo}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform motion-reduce:transition-none",
                  recolhidos.includes(grupo.titulo) && "-rotate-90",
                )}
              />
            </button>
            {recolhida && indiceGrupo > 0 ? (
              <hr
                className="border-sidebar-border mx-2 mb-2 hidden lg:block"
                aria-hidden="true"
              />
            ) : null}
            <ul
              id={`itens-${grupo.titulo}`}
              aria-labelledby={`menu-${grupo.titulo}`}
              className="contents lg:flex lg:flex-col lg:gap-1"
            >
              {grupo.itens.map((item) => {
                const ativo = estaAtivo(item.href);
                const Icon = item.icon;
                /*
                 * Recolhido, o grupo ainda mostra a página em que se está:
                 * esconder o item ativo tiraria do menu o "você está aqui".
                 * Só vale na barra larga; estreita ou no celular, tudo aparece.
                 */
                const escondido =
                  !recolhida && recolhidos.includes(grupo.titulo) && !ativo;
                return (
                  <li key={item.href} className={cn("flex-1 lg:flex-none", escondido && "lg:hidden")}>
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
                          tons[item.href] ??
                            "bg-secondary text-muted-foreground",
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
          </div>
        ))}
      </div>
    </nav>
  );
}
