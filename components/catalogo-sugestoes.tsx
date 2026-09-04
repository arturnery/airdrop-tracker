"use client";

import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { CategoryBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateBr } from "@/lib/dates";
import { normalizar } from "@/lib/dataset";
import type { ProjectCategory } from "@/lib/types";

/**
 * Cards de "quem administra está destacando", com um botão para adicionar ao
 * próprio portfólio (ARCHITECTURE §13).
 *
 * **Cópia, não vínculo**: clicar em adicionar copia os campos para um projeto
 * novo, inteiramente da pessoa. Editar ou apagar depois não alcança o
 * catálogo, e o catálogo mudar depois não alcança quem já adotou.
 *
 * Uma entrada já adotada some da lista. Uma entrada cujo nome colide com um
 * projeto que a pessoa já tem à mão fica com o botão desabilitado e avisando:
 * o banco recusaria mesmo assim, mas dizer antes de clicar é melhor do que
 * deixar tomar erro.
 */

type Sugestao = {
  id: string;
  nome: string;
  categoria: ProjectCategory | null;
  chain: string | null;
  resumo: string | null;
  tgePrevisto: string | null;
  links: { rotulo: string; href: string }[];
  colideComNome: boolean;
};

function useSugestoes(): Sugestao[] {
  const { dataset } = useDados();

  const nomesJaCadastrados = new Set(dataset.projects.map((p) => normalizar(p.name)));
  const idsJaAdotados = new Set(
    dataset.projects.map((p) => p.adoptedFromId).filter((id): id is string => id !== null),
  );

  return dataset.catalogProjects
    .filter((c) => c.publishedAt !== null && !idsJaAdotados.has(c.id))
    .map((c) => ({
      id: c.id,
      nome: c.name,
      categoria: c.category,
      chain: c.chain,
      resumo: c.summary,
      tgePrevisto: c.expectedTgeDate,
      colideComNome: nomesJaCadastrados.has(normalizar(c.name)),
      links: (
        [
          c.websiteUrl && { rotulo: "Site", href: c.websiteUrl },
          c.discordUrl && { rotulo: "Discord", href: c.discordUrl },
          c.twitterUrl && { rotulo: "X", href: c.twitterUrl },
          c.docsUrl && { rotulo: "Docs", href: c.docsUrl },
        ] as const
      ).filter((l): l is { rotulo: string; href: string } => Boolean(l)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function CardSugestao({ sugestao }: { sugestao: Sugestao }) {
  const { acoes, salvando } = useDados();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ocupado = enviando || salvando;

  return (
    <article className="bg-card border-border flex h-full flex-col rounded-lg border p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-brand/15 text-brand-legivel flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
        >
          {sugestao.nome.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">
            {sugestao.nome}
          </h3>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {sugestao.chain ?? "rede não informada"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={sugestao.categoria} />
        {sugestao.tgePrevisto ? (
          <span className="text-muted-foreground text-xs">
            TGE previsto {formatDateBr(sugestao.tgePrevisto)}
          </span>
        ) : null}
      </div>

      {sugestao.resumo ? (
        <p className="text-muted-foreground mt-3 flex-1 text-xs leading-relaxed">
          {sugestao.resumo}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      {sugestao.links.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {sugestao.links.map((link) => (
            <li key={link.rotulo}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="border-border hover:border-brand/50 focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {link.rotulo}
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={ocupado || sugestao.colideComNome}
          onClick={async () => {
            setErro(null);
            setEnviando(true);
            try {
              const resultado = await acoes.adotarDoCatalogo({
                catalogId: sugestao.id,
              });
              if (resultado) setErro(Object.values(resultado)[0] ?? "Não deu certo.");
            } finally {
              setEnviando(false);
            }
          }}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Adicionar ao meu portfólio
        </Button>
        {sugestao.colideComNome ? (
          <p className="text-muted-foreground mt-1.5 text-xs">
            Você já tem um projeto chamado &quot;{sugestao.nome}&quot;.
          </p>
        ) : erro ? (
          <p role="alert" className="text-negative mt-1.5 text-xs">
            {erro}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** `null` quando não há nada a sugerir: quem chama decide o que mostrar no lugar. */
export function SugestoesDoCatalogo() {
  const sugestoes = useSugestoes();
  if (sugestoes.length === 0) return null;

  return (
    <section aria-labelledby="sugestoes-catalogo" className="mb-10">
      <div className="mb-4">
        <h2 id="sugestoes-catalogo" className="text-base font-medium">
          Sugeridos pela comunidade
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Projetos que já estão sendo farmados. Adicionar copia os dados para o seu
          portfólio: editar ou apagar depois não muda o que aparece aqui.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sugestoes.map((s) => (
          <CardSugestao key={s.id} sugestao={s} />
        ))}
      </div>
    </section>
  );
}
