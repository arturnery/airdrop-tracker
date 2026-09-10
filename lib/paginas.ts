import {
  HelpCircle,
  History,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  ListChecks,
  Sparkles,
  Upload,
  UserCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Nome e ícone de cada página, por prefixo de rota.
 *
 * Existe separado da lista de `components/nav.tsx` de propósito: aquela é a
 * navegação principal (o que fica no menu), esta é "que página é essa"
 * (usada pela faixa fixa no topo do conteúdo, `BarraSuperior`). As duas
 * listas se sobrepõem bastante, e a duplicação é aceita aqui para não fazer
 * o menu depender de uma peça que não é dele: mexer numa não arrisca quebrar
 * a outra.
 */
export type PaginaInfo = { padrao: string; rotulo: string; icon: LucideIcon };

export const PAGINAS: PaginaInfo[] = [
  { padrao: "/tarefas", rotulo: "Tarefas", icon: ListChecks },
  { padrao: "/projetos", rotulo: "Projetos", icon: Layers },
  { padrao: "/contas", rotulo: "Contas", icon: Wallet },
  { padrao: "/historico", rotulo: "Histórico", icon: History },
  { padrao: "/importar", rotulo: "Importar", icon: Upload },
  { padrao: "/membros", rotulo: "Membros", icon: UserCheck },
  { padrao: "/suporte", rotulo: "Suporte", icon: LifeBuoy },
  { padrao: "/ajuda", rotulo: "Ajuda / Suporte", icon: HelpCircle },
  { padrao: "/novidades", rotulo: "Novidades", icon: Sparkles },
  { padrao: "/perfil", rotulo: "Perfil", icon: UserRound },
  { padrao: "/", rotulo: "Visão geral", icon: LayoutDashboard },
];

/**
 * Acha a página pelo caminho atual.
 *
 * Ordena do padrão mais longo para o mais curto antes de procurar: sem isso,
 * `/` bateria com qualquer rota (todo caminho começa com `/`) e nada depois
 * dele nesta lista seria alcançado.
 */
export function paginaAtual(pathname: string): PaginaInfo | null {
  const porEspecificidade = [...PAGINAS].sort(
    (a, b) => b.padrao.length - a.padrao.length,
  );
  return (
    porEspecificidade.find((p) =>
      p.padrao === "/" ? pathname === "/" : pathname.startsWith(p.padrao),
    ) ?? null
  );
}
