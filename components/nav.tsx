"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  History,
  UserCheck,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  ListChecks,
  CalendarDays,
  ChartCandlestick,
  ChartLine,
  Sprout,
  Trophy,
  Medal,
  Upload,
  Wallet,
} from "lucide-react";

import { useDados } from "@/components/data-provider";
import { selectPendingTasks } from "@/lib/selectors";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Sub-abas: o item vira um título que recolhe, como os grupos. */
  filhos?: Item[];
};

/**
 * O menu é dividido em áreas que não se misturam: o que é a carteira de cada
 * um (Airdrops), o que é da comunidade e a área de trade, as duas últimas
 * iguais para todos. Uma área nova entra como um grupo a mais, sem mexer nos
 * outros.
 */
const grupos: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Airdrops",
    itens: [
      { href: "/", label: "Visão geral", icon: LayoutDashboard },
      { href: "/tarefas", label: "Tarefas", icon: ListChecks },
      {
        href: "/projetos",
        label: "Projetos",
        icon: Layers,
        filhos: [
          { href: "/projetos", label: "Todos os projetos", icon: Layers },
          { href: "/projetos/farmando", label: "Farmando agora", icon: Sprout },
        ],
      },
      { href: "/contas", label: "Contas", icon: Wallet },
      {
        href: "/ranking",
        label: "Ranking",
        icon: Trophy,
        filhos: [
          { href: "/ranking", label: "Resultados", icon: Trophy },
          { href: "/ranking/pontos", label: "Pontos", icon: Medal },
        ],
      },
      { href: "/historico", label: "Histórico", icon: History },
      { href: "/importar", label: "Importar", icon: Upload },
    ],
  },
  {
    titulo: "Comunidade",
    itens: [{ href: "/comunidade/calendario", label: "Calendário", icon: CalendarDays }],
  },
  {
    titulo: "Trade",
    itens: [
      { href: "/trade/operacoes", label: "Operações", icon: ChartCandlestick },
      { href: "/trade/resultados", label: "Resultados", icon: ChartLine },
    ],
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

const grupoAdministracao: { titulo: string; itens: Item[] } = {
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
  "/ranking": "bg-chart-4/15 text-chart-4",
  "/ranking/pontos": "bg-chart-3/15 text-chart-3",
  "/trade/operacoes": "bg-chart-4/15 text-chart-4",
  "/trade/resultados": "bg-chart-2/15 text-chart-2",
  "/tarefas": "bg-chart-4/15 text-chart-4",
  "/projetos": "bg-chart-3/15 text-chart-3",
  "/projetos/farmando": "bg-chart-2/15 text-chart-2",
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
  sinaisNovos = 0,
  recolhida = false,
}: {
  ehAdmin?: boolean;
  /** Só chega preenchido para quem administra: ver o layout. */
  feedbackNaoLido?: number;
  /** Sinais de trade publicados desde a última visita à página de sinais. */
  sinaisNovos?: number;
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
        : href === "/trade/operacoes"
          ? sinaisNovos
          : 0;

  // Sinal é aviso de algo novo, não pendência: o selo leva um sininho.
  const comSino = (href: string) => href === "/trade/operacoes";

  const casa = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  /*
   * Ativo é o item cujo endereço casa, a menos que outro mais específico
   * também case: em `/projetos/farmando` acende "Farmando agora", e não
   * "Todos os projetos", que é o prefixo dele. A página de um projeto
   * (`/projetos/slug`) fica com "Todos os projetos".
   */
  const todosOsHrefs = grupos.flatMap((g) => g.itens.flatMap((i) => [i.href, ...(i.filhos ?? []).map((f) => f.href)]));
  const estaAtivo = (href: string) =>
    casa(href) && !todosOsHrefs.some((outro) => outro.length > href.length && outro.startsWith(href) && casa(outro));
  const itemAtivo = (item: Item) => (item.filhos ? item.filhos.some((f) => estaAtivo(f.href)) : estaAtivo(item.href));

  /** O link de um item (ou de uma sub-aba), com ícone, rótulo e contagem. */
  const linkDoItem = (item: Item, ativo: boolean) => {
    const Icon = item.icon;
    return (
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
            <span
              className="bg-caution/15 text-caution tabular ml-auto hidden items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium lg:inline-flex"
              aria-label={comSino(item.href) ? `${contagem(item.href)} operações novas` : undefined}
            >
              {comSino(item.href) ? <Bell className="size-3" aria-hidden="true" /> : null}
              {contagem(item.href) > 9 && comSino(item.href) ? "9+" : contagem(item.href)}
            </span>
          )
        ) : null}
      </Link>
    );
  };

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
              <span className="flex items-center gap-1.5">
                {grupo.titulo}
                {/*
                  Recolhido, o grupo esconde os itens e os números deles: o
                  total vai para o título, senão um sinal novo sumiria junto.
                */}
                {recolhidos.includes(grupo.titulo) &&
                grupo.itens.some((i) => !itemAtivo(i) && contagem(i.href) > 0) ? (
                  <span
                    className="bg-caution size-1.5 rounded-full"
                    aria-label="há novidades neste grupo"
                  />
                ) : null}
              </span>
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
                const ativo = itemAtivo(item);
                /*
                 * Recolhido, o grupo ainda mostra a página em que se está:
                 * esconder o item ativo tiraria do menu o "você está aqui".
                 * Só vale na barra larga; estreita ou no celular, tudo aparece.
                 */
                const escondido =
                  !recolhida && recolhidos.includes(grupo.titulo) && !ativo;

                /*
                 * Item com sub-abas: na barra larga, o título recolhe pela
                 * seta como os grupos (guardado na mesma lista, com o prefixo
                 * `item:`); as sub-abas vêm recuadas embaixo. No celular e na
                 * barra estreita não há título, e as sub-abas viram itens
                 * comuns.
                 */
                if (item.filhos) {
                  const chave = `item:${item.label}`;
                  const fechado = recolhidos.includes(chave);
                  return (
                    <li key={item.href} className={cn("contents", escondido && "lg:hidden")}>
                      <button
                        type="button"
                        aria-expanded={!fechado}
                        aria-controls={`subitens-${item.label}`}
                        onClick={() => alternarRecolhido(chave, recolhidos)}
                        className={cn(
                          "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:ring-ring hidden w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none lg:flex",
                          recolhida && "lg:hidden",
                          ativo && "text-sidebar-accent-foreground",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md",
                            tons[item.href] ?? "bg-secondary text-muted-foreground",
                          )}
                        >
                          <item.icon className="size-4" />
                        </span>
                        <span>{item.label}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "ml-auto size-3.5 transition-transform motion-reduce:transition-none",
                            fechado && "-rotate-90",
                          )}
                        />
                      </button>
                      <ul
                        id={`subitens-${item.label}`}
                        className={cn("contents lg:flex lg:flex-col lg:gap-1", !recolhida && "lg:ml-4 lg:border-l lg:border-sidebar-border lg:pl-2")}
                      >
                        {item.filhos.map((filho) => {
                          const filhoAtivo = estaAtivo(filho.href);
                          const filhoEscondido = !recolhida && fechado && !filhoAtivo;
                          return (
                            <li key={filho.href} className={cn("flex-1 lg:flex-none", filhoEscondido && "lg:hidden")}>
                              {linkDoItem(filho, filhoAtivo)}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                }

                return (
                  <li key={item.href} className={cn("flex-1 lg:flex-none", escondido && "lg:hidden")}>
                    {linkDoItem(item, ativo)}
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
