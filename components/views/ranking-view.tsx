"use client";

import { useState } from "react";
import Link from "next/link";
import { Medal, Trophy } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/page-header";
import { Money } from "@/components/money";
import { formatDateShort } from "@/lib/dates";
import { formatPoints } from "@/lib/points";
import { ordenarRanking, type AirdropRecente, type LinhaDeResultado, type OrdemDoRanking, type RankingDoProjeto } from "@/lib/ranking";
import { cn } from "@/lib/utils";

/**
 * As duas abas do ranking da comunidade (ARCHITECTURE §22). Recebem só as
 * linhas prontas, calculadas no servidor: o Dataset dos membros nunca chega
 * ao navegador.
 *
 * Posição em selo neutro: verde e vermelho seguem reservados a ganho e
 * perda (§14.8), e aparecem só no valor do resultado.
 */

function Posicao({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
        n <= 3 ? "bg-brand/15 text-brand-legivel" : "bg-secondary text-muted-foreground",
      )}
      aria-label={`${n}º lugar`}
    >
      {n}
    </span>
  );
}

function AvisoDeParticipacao({ euApareco }: { euApareco: boolean }) {
  return (
    <p className="text-muted-foreground mb-6 text-sm">
      {euApareco
        ? "Você aparece neste ranking, com o seu nome e os seus números. Para sair, desligue em "
        : "Você não aparece no ranking: os seus números ficam só com você. Para entrar, ligue em "}
      <Link href="/perfil" className="text-foreground underline underline-offset-4">
        Perfil
      </Link>
      .
    </p>
  );
}

function Nome({ nome, eu }: { nome: string; eu: boolean }) {
  return (
    <span className="min-w-0 truncate font-medium">
      {nome}
      {eu ? <span className="text-muted-foreground ml-1.5 text-xs font-normal">(você)</span> : null}
    </span>
  );
}

export function RankingResultadosView({
  linhas,
  recentes,
  meuId,
  euApareco,
}: {
  linhas: LinhaDeResultado[];
  recentes: AirdropRecente[];
  meuId: string;
  euApareco: boolean;
}) {
  return (
    <>
      <PageHeader
        icon={Trophy}
        title="Ranking de resultados"
        description="O resultado de cada membro com airdrops, rendimentos e trades, menos taxas: o mesmo número da Visão geral de cada um."
      />
      <AvisoDeParticipacao euApareco={euApareco} />

      {linhas.length === 0 ? (
        <EmptyState
          title="Ninguém no ranking ainda."
          description="Quando os membros lançarem resultados, eles aparecem aqui."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <section aria-labelledby="ranking-resultado" className="bg-card border-border self-start rounded-lg border">
            <h2 id="ranking-resultado" className="sr-only">
              Ranking
            </h2>
            <div className="text-muted-foreground border-border grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2 text-xs sm:grid-cols-[2rem_minmax(0,1fr)_7rem_8rem]">
              <span>#</span>
              <span>Membro</span>
              <span className="hidden text-right sm:block">Airdrops</span>
              <span className="text-right">Resultado</span>
            </div>
            <ol>
              {linhas.map((l) => (
                <li
                  key={l.userId}
                  className={cn(
                    "border-border grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_7rem_8rem]",
                    l.userId === meuId && "bg-secondary/40",
                  )}
                >
                  <Posicao n={l.posicao} />
                  <span className="flex min-w-0 flex-col">
                    <Nome nome={l.nome} eu={l.userId === meuId} />
                    <span className="text-muted-foreground text-xs sm:hidden">
                      {l.projetosComAirdrop} {l.projetosComAirdrop === 1 ? "airdrop" : "airdrops"}
                    </span>
                  </span>
                  <span className="text-muted-foreground hidden text-right text-xs sm:block">
                    {l.projetosComAirdrop > 0 ? (
                      <>
                        {l.projetosComAirdrop} · <Money value={l.airdrops} compact />
                      </>
                    ) : (
                      "nenhum ainda"
                    )}
                  </span>
                  <span className="text-right font-semibold">
                    <Money value={l.resultado} tone="auto" signed />
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="airdrops-recentes">
            <h2 id="airdrops-recentes" className="mb-3 text-base font-medium">
              Últimos airdrops da comunidade
            </h2>
            {recentes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum airdrop registrado ainda.</p>
            ) : (
              <ul className="bg-card border-border divide-border divide-y rounded-lg border">
                {recentes.map((r) => (
                  <li key={`${r.userId}-${r.projeto}-${r.data}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Nome nome={r.nome} eu={r.userId === meuId} />
                      <span className="text-muted-foreground block truncate text-xs">
                        {r.projeto} · {r.token} · {formatDateShort(r.data)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">
                      <Money value={r.valor} tone="auto" signed />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export function RankingPontosView({
  projetos,
  meuId,
  euApareco,
}: {
  projetos: RankingDoProjeto[];
  meuId: string;
  euApareco: boolean;
}) {
  const [chave, setChave] = useState(projetos[0]?.chave ?? null);
  const [escolha, setEscolha] = useState<OrdemDoRanking | null>(null);
  const atual = projetos.find((p) => p.chave === chave) ?? projetos[0] ?? null;
  // A ordem escolhida só vale se o projeto tiver aquela grandeza.
  const ordem: OrdemDoRanking | null = !atual
    ? null
    : escolha === "volume" && atual.temVolume
      ? "volume"
      : escolha === "pontos" && atual.temPontos
        ? "pontos"
        : atual.temPontos
          ? "pontos"
          : "volume";
  const linhas = atual && ordem ? ordenarRanking(atual.linhas, ordem) : [];

  return (
    <>
      <PageHeader
        icon={Medal}
        title="Ranking de pontos e volume"
        description="Os pontos e o volume de cada membro por projeto: a soma da última medição de cada conta, como na página do projeto."
      />
      <AvisoDeParticipacao euApareco={euApareco} />

      {!atual ? (
        <EmptyState
          title="Nenhum ponto ou volume registrado ainda."
          description="Quando os membros registrarem pontos ou volume nos projetos, o ranking de cada projeto aparece aqui."
        />
      ) : (
        <>
          <div role="tablist" aria-label="Projeto" className="mb-4 flex flex-wrap gap-2">
            {projetos.map((p) => (
              <button
                key={p.chave}
                type="button"
                role="tab"
                aria-selected={p.chave === atual.chave}
                onClick={() => setChave(p.chave)}
                className={cn(
                  "focus-visible:ring-ring rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  p.chave === atual.chave
                    ? "border-brand/50 bg-brand/15 text-foreground font-medium"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.nome}
                <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">{p.linhas.length}</span>
              </button>
            ))}
          </div>

          {atual.temPontos && atual.temVolume ? (
            <div className="mb-3 flex items-center gap-2 text-sm" role="group" aria-label="Ordenar por">
              <span className="text-muted-foreground text-xs">Ordenar por</span>
              {(["pontos", "volume"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={ordem === o}
                  onClick={() => setEscolha(o)}
                  className={cn(
                    "focus-visible:ring-ring rounded-md border px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    ordem === o ? "border-brand/50 bg-brand/15 font-medium" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o === "pontos" ? atual.rotulo ?? "Pontos" : "Volume"}
                </button>
              ))}
            </div>
          ) : null}

          <section aria-label={`Ranking de ${atual.nome}`} className="bg-card border-border rounded-lg border">
            <div className="text-muted-foreground border-border grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem] items-center gap-3 border-b px-4 py-2 text-xs sm:grid-cols-[2rem_minmax(0,1fr)_6rem_8rem_8rem]">
              <span>#</span>
              <span>Membro</span>
              <span className="hidden text-right sm:block">Medido</span>
              <span className={cn("text-right", ordem === "pontos" && "text-foreground font-medium")}>
                {atual.rotulo ?? "Pontos"}
              </span>
              <span className={cn("text-right", ordem === "volume" && "text-foreground font-medium")}>Volume</span>
            </div>
            <ol>
              {linhas.map((l) => (
                <li
                  key={l.userId}
                  className={cn(
                    "border-border grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem] items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_8rem_8rem]",
                    l.userId === meuId && "bg-secondary/40",
                  )}
                >
                  {l.posicao > 0 ? <Posicao n={l.posicao} /> : <span className="text-muted-foreground text-center text-xs">-</span>}
                  <Nome nome={l.nome} eu={l.userId === meuId} />
                  <span className="text-muted-foreground hidden text-right text-xs sm:block">
                    {l.atualizadoEm ? formatDateShort(l.atualizadoEm) : "-"}
                  </span>
                  <span className={cn("text-right tabular-nums", ordem === "pontos" ? "font-semibold" : "text-muted-foreground")}>
                    {l.pontos !== null ? formatPoints(l.pontos) : "-"}
                  </span>
                  <span className={cn("text-right tabular-nums", ordem === "volume" ? "font-semibold" : "text-muted-foreground")}>
                    {l.volume !== null ? <Money value={l.volume} /> : "-"}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  );
}
