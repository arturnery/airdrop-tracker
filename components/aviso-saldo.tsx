import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import type { AlertaProjeto } from "@/lib/consistencia";
import { cn } from "@/lib/utils";

/**
 * Aviso de saldo que a realidade não permite.
 *
 * Usa `caution` e não `negative`, e a escolha é de significado: vermelho aqui
 * diria "você perdeu dinheiro", que é justamente o que **não** aconteceu. O que
 * há é um lançamento faltando, e âmbar é a cor de "olhe isto", não a de prejuízo.
 *
 * O ícone vem acompanhado de texto sempre, nunca sozinho: cor e símbolo não
 * podem ser o único sinal de nada.
 */
export function AvisoSaldo({
  alerta,
  className,
}: {
  alerta: AlertaProjeto;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "border-caution/40 bg-caution/10 text-caution flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-foreground/90">{alerta.detalhe}</span>
    </p>
  );
}

/**
 * Marca curta, para caber ao lado do número numa linha de tabela.
 *
 * O `title` carrega o detalhe para quem passar o mouse, e o texto visível já diz
 * o suficiente para a pessoa saber que aquela linha pede atenção sem precisar
 * passar por cima de nada.
 */
export function MarcaSaldo({ alerta }: { alerta: AlertaProjeto }) {
  return (
    <span
      className="text-caution ml-2 inline-flex items-center gap-1 text-xs whitespace-nowrap"
      title={alerta.detalhe}
    >
      <TriangleAlert className="size-3" aria-hidden="true" />
      {alerta.resumo}
    </span>
  );
}

/**
 * Resumo no topo da visão geral.
 *
 * Fica acima da tabela porque a tabela pode estar rolada para fora da vista, e
 * um aviso que só existe dentro dela não é visto por quem não foi olhar. Some
 * inteiro quando não há nada a dizer: aviso permanente vira paisagem.
 */
export function ResumoDeAvisos({
  projetos,
}: {
  projetos: { slug: string; nome: string; alerta: AlertaProjeto | null }[];
}) {
  const comAlerta = projetos.filter(
    (p): p is { slug: string; nome: string; alerta: AlertaProjeto } =>
      p.alerta !== null,
  );

  if (comAlerta.length === 0) return null;

  return (
    <section
      aria-label="Avisos de consistência"
      className="border-caution/40 bg-caution/10 mb-8 rounded-lg border px-4 py-3"
    >
      <h2 className="text-caution flex items-center gap-2 text-sm font-medium">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        {comAlerta.length === 1
          ? "1 projeto com saldo que não fecha"
          : `${comAlerta.length} projetos com saldo que não fecha`}
      </h2>

      <ul className="mt-2 space-y-1.5">
        {comAlerta.map((projeto) => (
          <li key={projeto.slug} className="text-sm">
            <Link
              href={`/projetos/${projeto.slug}`}
              className="hover:text-brand-legivel focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {projeto.nome}
            </Link>
            <span className="text-muted-foreground"> · {projeto.alerta.detalhe}</span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground mt-3 text-xs">
        O aviso some sozinho quando o lançamento que falta for registrado.
      </p>
    </section>
  );
}
