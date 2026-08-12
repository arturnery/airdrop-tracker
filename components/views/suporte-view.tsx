"use client";

import { useState, useTransition } from "react";
import { Check, Mail } from "lucide-react";

import { marcarFeedback } from "@/actions/feedback";
import { FiltroChips } from "@/components/filtro-chips";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import type { FeedbackRow } from "@/db/queries/feedback";
import { formatDateBr } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Leitura dos relatos, para quem administra. Ver ARCHITECTURE.md §14.
 *
 * Não há resposta por aqui: a conversa sai por e-mail, e o botão monta um
 * `mailto:` com destinatário, assunto e o relato citado. O atrito de responder
 * é o que decide se as respostas acontecem, então tirar o "procurar o e-mail e
 * copiar o texto" do caminho vale mais que qualquer tela de composição.
 */
const rotulos: Record<FeedbackRow["tipo"], string> = {
  bug: "Erro",
  duvida: "Dúvida",
  sugestao: "Sugestão",
};

const cores: Record<FeedbackRow["tipo"], string> = {
  bug: "border-negative/40 bg-negative/10 text-negative",
  duvida: "border-border bg-secondary text-muted-foreground",
  sugestao: "border-positive/40 bg-positive/10 text-positive",
};

function linkDeResposta(relato: FeedbackRow) {
  const assunto = `Re: seu relato no airdrop-tracker (${rotulos[relato.tipo]})`;
  const citado = relato.mensagem
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

  const corpo = [
    `Olá, ${relato.autorNome}.`,
    "",
    "",
    "---",
    citado,
    `> enviado em ${formatDateBr(relato.criadoEm)}${relato.rota ? ` na tela ${relato.rota}` : ""}`,
  ].join("\n");

  return `mailto:${relato.autorEmail}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

export function SuporteView({ relatos }: { relatos: FeedbackRow[] }) {
  const [filtro, setFiltro] = useState<FeedbackRow["tipo"] | null>(null);
  const [salvando, iniciar] = useTransition();

  const naoLidos = relatos.filter((r) => !r.lido).length;
  const emAberto = relatos.filter((r) => !r.resolvido).length;

  const visiveis = relatos.filter((r) => filtro === null || r.tipo === filtro);
  const contar = (tipo: FeedbackRow["tipo"]) =>
    relatos.filter((r) => r.tipo === tipo).length;

  const marcar = (id: string, estado: "lido" | "resolvido") =>
    iniciar(async () => {
      await marcarFeedback(id, estado);
    });

  return (
    <>
      <PageHeader
        title="Suporte"
        description="Relatos enviados pelo sistema. A resposta sai por e-mail."
      />

      <section aria-label="Resumo dos relatos" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Não lidos"
          accent={naoLidos > 0 ? "caution" : "idle"}
          value={<span className="tabular">{naoLidos}</span>}
          hint={naoLidos > 0 ? "aguardando leitura" : "tudo lido"}
        />
        <StatCard
          label="Em aberto"
          accent={emAberto > 0 ? "primary" : "idle"}
          value={<span className="tabular">{emAberto}</span>}
          hint="lidos, ainda não resolvidos"
        />
        <StatCard
          label="Total recebido"
          accent="idle"
          value={<span className="tabular">{relatos.length}</span>}
          hint="desde o começo"
        />
      </section>

      {relatos.length === 0 ? (
        <p className="text-muted-foreground border-border mt-8 rounded-lg border border-dashed px-4 py-12 text-center text-sm">
          Nenhum relato ainda. Quem usa o sistema envia pelo rodapé, e o relato
          chega aqui com a tela de origem e a versão.
        </p>
      ) : (
        <>
          <div className="border-border mt-8 mb-6 rounded-lg border p-4">
            <FiltroChips
              legenda="Tipo de relato"
              selecionado={filtro}
              aoSelecionar={setFiltro}
              opcoes={[
                { valor: null, rotulo: "Todos", contagem: relatos.length },
                ...(Object.keys(rotulos) as FeedbackRow["tipo"][]).flatMap((t) =>
                  contar(t) > 0
                    ? [{ valor: t, rotulo: rotulos[t], contagem: contar(t) }]
                    : [],
                ),
              ]}
            />
          </div>

          <ul className="space-y-4">
            {visiveis.map((relato) => (
              <li
                key={relato.id}
                className={cn(
                  "border-border rounded-lg border p-4",
                  !relato.lido && "border-caution/40 bg-caution/5",
                  relato.resolvido && "opacity-60",
                )}
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      cores[relato.tipo],
                    )}
                  >
                    {rotulos[relato.tipo]}
                  </span>
                  <span className="text-sm font-medium">{relato.autorNome}</span>
                  <span className="text-muted-foreground text-xs">
                    {relato.autorEmail}
                  </span>
                  {relato.ehDemo ? (
                    <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                      conta de demonstração
                    </span>
                  ) : null}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {formatDateBr(relato.criadoEm)}
                  </span>
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {relato.mensagem}
                </p>

                {/* O contexto que a pessoa não digitou: é o que torna o relato
                    investigável sem uma segunda pergunta. */}
                <p className="text-muted-foreground mt-3 text-xs">
                  {relato.rota ? <>tela {relato.rota}</> : "tela não informada"}
                  {relato.versao ? <> · versão {relato.versao}</> : null}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={linkDeResposta(relato)}>
                      <Mail className="size-3.5" aria-hidden="true" />
                      Responder por e-mail
                    </a>
                  </Button>

                  {!relato.lido ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={salvando}
                      onClick={() => marcar(relato.id, "lido")}
                    >
                      Marcar como lido
                    </Button>
                  ) : null}

                  {!relato.resolvido ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={salvando}
                      onClick={() => marcar(relato.id, "resolvido")}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      Resolvido
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">resolvido</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
