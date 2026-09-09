"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { CategoryBadge, PriorityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
 *
 * Mesmo formato do card de projeto (ícone, nome, categoria e prioridade como
 * selo, linha, ação embaixo): resumo, links e TGE saíram daqui para os dois
 * cards lerem como a mesma família visual. Custo aceito, e não descoberto:
 * sem o resumo, o card conta menos sobre o projeto antes do clique, e quem
 * quiser saber mais decide pelo nome, pela categoria e pela prioridade, não
 * por uma frase de venda.
 *
 * A prioridade aqui é a de quem publicou, copiada no momento de destacar
 * (ver a nota em `db/schema.ts` sobre esta ser a única exceção à divisão
 * editorial/pessoal do catálogo). Quem adota recebe este valor como ponto
 * de partida, livre para mudar depois sem afetar o catálogo.
 */

type Sugestao = {
  id: string;
  nome: string;
  categoria: ProjectCategory | null;
  prioridade: number;
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
      prioridade: c.priority,
      colideComNome: nomesJaCadastrados.has(normalizar(c.name)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function CardSugestao({ sugestao }: { sugestao: Sugestao }) {
  const { acoes, salvando } = useDados();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ocupado = enviando || salvando;

  return (
    <article className="bg-card border-border flex h-full flex-col rounded-lg border p-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-brand/15 text-brand-legivel flex size-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
        >
          {sugestao.nome.trim().charAt(0).toUpperCase()}
        </span>
        <h3 className="min-w-0 truncate text-lg font-semibold tracking-tight">
          {sugestao.nome}
        </h3>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={sugestao.categoria} />
        <PriorityBadge value={sugestao.prioridade} />
      </div>

      <div className="border-border mt-4 flex flex-1 flex-col justify-end gap-1.5 border-t pt-3">
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
          <p className="text-muted-foreground text-xs">
            Você já tem um projeto chamado &quot;{sugestao.nome}&quot;.
          </p>
        ) : erro ? (
          <p role="alert" className="text-negative text-xs">
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
          Farms atuais
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Projetos que já estão sendo farmados.
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
