"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Rss } from "lucide-react";

import { salvarListaDoX } from "@/actions/feed-x";
import { FeedListaX } from "@/components/feed-lista-x";
import { IconeX } from "@/components/icones-marca";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { arrobasParaCopiar, type ProjetoNoX } from "@/lib/feed-x";
import { cn } from "@/lib/utils";

/**
 * Feed do X dos projetos da comunidade (ARCHITECTURE §26): a Lista do X em
 * destaque e, ao lado, o perfil de cada projeto ativo. Os perfis existem
 * mesmo quando o feed não aparece (o X só mostra o embed a quem está logado
 * nele), para a página nunca ficar vazia.
 */
export function FeedXView({ lista, projetos, ehAdmin }: { lista: string | null; projetos: ProjetoNoX[]; ehAdmin: boolean }) {
  const comPerfil = projetos.filter((p) => p.perfil);
  const semPerfil = projetos.filter((p) => !p.perfil);
  return (
    <>
      <PageHeader
        icon={Rss}
        title="Feed do X"
        description="O que os projetos que a comunidade farma estão postando no X, num lugar só."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Feed da Lista do X" className="bg-card border-border min-w-0 rounded-lg border">
          {lista ? (
            <>
              <div className="p-2 sm:p-4">
                <FeedListaX lista={lista} />
              </div>
              <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-muted-foreground max-w-prose text-xs">
                  O feed não apareceu, ou mostra &quot;Rate limit exceeded&quot;? O X só exibe o feed para quem está logado no X
                  neste navegador. Entre no X ou abra a Lista direto por lá.
                </p>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={lista} target="_blank" rel="noopener noreferrer">
                    <IconeX className="size-3.5" />
                    Abrir a Lista no X
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex min-h-60 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm font-medium">O feed ainda não foi configurado.</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                {ehAdmin
                  ? "Monte a Lista do X com os perfis dos projetos e cole o link dela em Configurar o feed, ao lado."
                  : "Enquanto isso, os perfis de cada projeto estão ao lado."}
              </p>
            </div>
          )}
        </section>

        <aside className="grid min-w-0 content-start gap-6">
          {ehAdmin ? <ConfigurarFeed lista={lista} projetos={projetos} semPerfil={semPerfil.length} /> : null}

          <section aria-labelledby="perfis-projetos" className="bg-card border-border rounded-lg border">
            <h2 id="perfis-projetos" className="text-muted-foreground px-4 pt-4 text-xs font-medium tracking-wider uppercase">
              Projetos no X · {comPerfil.length}
            </h2>
            {comPerfil.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-sm">Nenhum projeto ativo com o X cadastrado ainda.</p>
            ) : (
              <ul className="divide-border/70 mt-2 divide-y">
                {comPerfil.map((p) => (
                  <li key={p.nome}>
                    <a
                      href={`https://x.com/${p.perfil}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:bg-accent/50 focus-visible:ring-ring flex items-center gap-3 px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                    >
                      <span aria-hidden="true" className="bg-brand/15 text-brand-legivel flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold">
                        {p.nome.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.nome}</span>
                        <span className="text-muted-foreground block truncate font-mono text-xs">@{p.perfil}</span>
                      </span>
                      <ExternalLink className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                      <span className="sr-only">(abre o perfil no X)</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {ehAdmin && semPerfil.length > 0 ? (
              <div className="border-border border-t px-4 py-3">
                <p className="text-caution text-xs font-medium">Sem o X cadastrado ({semPerfil.length})</p>
                <p className="text-muted-foreground mt-1 text-xs">{semPerfil.map((p) => p.nome).join(", ")}</p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Cadastre o X no projeto e use Destacar de novo para atualizar o destaque.
                </p>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}

function ConfigurarFeed({ lista, projetos, semPerfil }: { lista: string | null; projetos: ProjetoNoX[]; semPerfil: number }) {
  const [valor, setValor] = useState(lista ?? "");
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const arrobas = arrobasParaCopiar(projetos);

  return (
    <details open={!lista} className="bg-card border-border group rounded-lg border">
      <summary className="focus-visible:ring-ring cursor-pointer list-none rounded-lg px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
        Configurar o feed <span className="text-muted-foreground text-xs font-normal">(só admins veem)</span>
      </summary>
      <ol className="space-y-4 px-4 pb-4 text-sm">
        <li>
          <p className="font-medium">1. Crie uma Lista pública no X</p>
          <p className="text-muted-foreground mt-0.5 text-xs">No X: Perfil → Listas → Criar nova lista. Deixe pública.</p>
        </li>
        <li>
          <p className="font-medium">2. Adicione os perfis dos projetos</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {projetos.length - semPerfil} {projetos.length - semPerfil === 1 ? "perfil" : "perfis"} dos projetos ativos (sem os
            distribuídos e descartados).
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 gap-1.5"
            disabled={!arrobas}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(arrobas);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                setEstado({ tipo: "erro", texto: "Não consegui copiar. Selecione os @ na lista ao lado." });
              }
            }}
          >
            {copiado ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copiado ? "Copiados" : "Copiar todos os @"}
          </Button>
        </li>
        <li>
          <p className="font-medium">3. Cole aqui o link da Lista</p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setSalvando(true);
              setEstado(null);
              const r = await salvarListaDoX(valor);
              setSalvando(false);
              setEstado(r.ok ? { tipo: "ok", texto: valor.trim() ? "Lista salva." : "Lista removida." } : { tipo: "erro", texto: Object.values(r.erros)[0] ?? "Não foi possível salvar." });
            }}
          >
            <label className="sr-only" htmlFor="lista-x">
              Link da Lista do X
            </label>
            <input
              id="lista-x"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="url"
              autoComplete="off"
              placeholder="https://x.com/i/lists/..."
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-[3px]"
            />
            <Button type="submit" size="sm" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </form>
          {estado ? (
            <p role="status" className={cn("mt-1.5 text-xs", estado.tipo === "ok" ? "text-muted-foreground" : "text-negative")}>
              {estado.texto}
            </p>
          ) : null}
        </li>
      </ol>
    </details>
  );
}
