import { BookOpen, Globe } from "lucide-react";

import { IconeDiscord, IconeX, IconeYoutube } from "@/components/icones-marca";
import type { ProjectLinks } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Ordem: o que mais se procura primeiro. O site e o tutorial são o "como
 * começo"; docs, X e Discord são consulta.
 */
const ITENS = [
  { chave: "website", rotulo: "Site", Icone: Globe },
  { chave: "tutorial", rotulo: "Vídeo tutorial", Icone: IconeYoutube },
  { chave: "docs", rotulo: "Docs", Icone: BookOpen },
  { chave: "twitter", rotulo: "X (Twitter)", Icone: IconeX },
  { chave: "discord", rotulo: "Discord", Icone: IconeDiscord },
] as const;

/**
 * Atalhos para os links do projeto, em ícones, só os que estão preenchidos.
 * Não renderiza nada quando não há nenhum.
 *
 * Os links já chegam filtrados (`linksDoProjeto` só deixa passar `http(s)`).
 */
export function LinksDoProjeto({
  nome,
  links,
  className,
}: {
  nome: string;
  links: ProjectLinks;
  className?: string;
}) {
  const presentes = ITENS.filter((i) => links[i.chave]);
  if (presentes.length === 0) return null;

  return (
    <ul className={cn("flex items-center gap-0.5", className)} aria-label={`Links de ${nome}`}>
      {presentes.map(({ chave, rotulo, Icone }) => (
        <li key={chave}>
          <a
            href={links[chave]!}
            target="_blank"
            rel="noopener noreferrer"
            title={rotulo}
            aria-label={`${rotulo} de ${nome} (abre em nova aba)`}
            className="hover:text-foreground hover:bg-secondary focus-visible:ring-ring flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icone className="size-3.5" />
          </a>
        </li>
      ))}
    </ul>
  );
}
