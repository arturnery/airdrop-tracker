"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Repeat,
  Star,
} from "lucide-react";

import { BotaoLixeira, ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { EditarLive, NovaLive, ROTULO_RECORRENCIA } from "@/components/forms/live";
import { useDados } from "@/components/data-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deslocarMes,
  formatarQuando,
  horaCurta,
  nomeDoDia,
  nomeDoMes,
  type Ocorrencia,
} from "@/lib/lives";
import { cn } from "@/lib/utils";

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Calendário da comunidade, no formato de grade mensal que a comunidade já
 * usa para divulgar a programação: cada dia com as lives em ordem de
 * horário, "19h · apresentador" e o tema embaixo, e o evento especial do mês
 * em destaque.
 *
 * Diferente do resto do app, que é a carteira de cada um, aqui o conteúdo é o
 * mesmo para todos e só quem administra escreve. Os controles de
 * administração só aparecem para quem administra, mas a trava de verdade é a
 * das Server Actions (`exigirAdministrador`).
 */
export function CalendarioView({
  mes,
  mesAtual,
  hoje,
  semanas,
  ocorrencias,
  ehAdmin,
}: {
  mes: string;
  mesAtual: string;
  hoje: string;
  semanas: (string | null)[][];
  ocorrencias: Ocorrencia[];
  ehAdmin: boolean;
}) {
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);

  const porDia = new Map<string, Ocorrencia[]>();
  for (const o of ocorrencias) porDia.set(o.dia, [...(porDia.get(o.dia) ?? []), o]);

  const comEventos = [...porDia.keys()].sort();

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Calendário"
        description="Programação de lives da comunidade Level Cripto. Horários de Brasília."
        actions={ehAdmin ? <NovaLive /> : null}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <NavegarMes mes={deslocarMes(mes, -1)} rotulo="Mês anterior" icone="anterior" />
          <h2 className="min-w-44 text-center text-lg font-medium">{nomeDoMes(mes)}</h2>
          <NavegarMes mes={deslocarMes(mes, 1)} rotulo="Próximo mês" icone="proximo" />
        </div>
        {mes !== mesAtual ? (
          <Link
            href={`?mes=${mesAtual}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            Hoje
          </Link>
        ) : null}
      </div>

      {/* Grade: a partir de telas médias. Sete colunas no celular não cabem
          nem o horário. */}
      <div className="border-border hidden overflow-hidden rounded-lg border md:block">
        <div className="bg-secondary/60 grid grid-cols-7">
          {DIAS_DA_SEMANA.map((d) => (
            <div
              key={d}
              className="text-muted-foreground border-border border-r px-2 py-2 text-center text-xs font-medium tracking-wider uppercase last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        {semanas.map((semana, i) => (
          <div key={i} className="border-border grid grid-cols-7 border-t">
            {semana.map((dia, j) => (
              <Celula
                key={dia ?? `vazio-${i}-${j}`}
                dia={dia}
                hoje={hoje}
                eventos={dia ? (porDia.get(dia) ?? []) : []}
                ehAdmin={ehAdmin}
                aoAbrir={setAberta}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Lista: no celular, só os dias que têm alguma coisa. */}
      <div className="md:hidden">
        {comEventos.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Nenhuma live marcada neste mês.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {comEventos.map((dia) => (
              <li key={dia} className={cn("px-4 py-3", dia < hoje && "opacity-60")}>
                <p className={cn("mb-2 text-sm font-medium", dia === hoje && "font-semibold")}>
                  {nomeDoDia(dia)}
                  {dia === hoje ? " · hoje" : ""}
                </p>
                <div className="space-y-1.5">
                  {porDia.get(dia)!.map((o) => (
                    <Evento key={o.quando + o.live.id} ocorrencia={o} aoAbrir={setAberta} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Detalhes ocorrencia={aberta} ehAdmin={ehAdmin} aoFechar={() => setAberta(null)} />
    </>
  );
}

function NavegarMes({
  mes,
  rotulo,
  icone,
}: {
  mes: string;
  rotulo: string;
  icone: "anterior" | "proximo";
}) {
  const Icone = icone === "anterior" ? ChevronLeft : ChevronRight;
  return (
    <Button asChild variant="ghost" size="icon" className="size-8">
      <Link href={`?mes=${mes}`} aria-label={rotulo} title={rotulo}>
        <Icone className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  );
}

function Celula({
  dia,
  hoje,
  eventos,
  ehAdmin,
  aoAbrir,
}: {
  dia: string | null;
  hoje: string;
  eventos: Ocorrencia[];
  ehAdmin: boolean;
  aoAbrir: (o: Ocorrencia) => void;
}) {
  if (!dia) return <div className="bg-secondary/20 border-border min-h-28 border-r last:border-r-0" />;

  const ehHoje = dia === hoje;
  return (
    <div
      className={cn(
        "group border-border relative flex min-h-28 flex-col gap-1 border-r p-1.5 last:border-r-0",
        dia < hoje && "bg-secondary/10",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
            // Neutro, não azul: o azul é só da marca (ARCHITECTURE §14.8).
            ehHoje ? "bg-foreground text-background" : dia < hoje ? "text-muted-foreground" : "",
          )}
          aria-label={ehHoje ? `${Number(dia.slice(8))}, hoje` : undefined}
        >
          {Number(dia.slice(8))}
        </span>
        {ehAdmin ? (
          <NovaLive
            dia={dia}
            gatilho={
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Nova live em ${dia.split("-").reverse().join("/")}`}
                title="Nova live neste dia"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />
        ) : null}
      </div>
      {eventos.map((o) => (
        <Evento key={o.quando + o.live.id} ocorrencia={o} aoAbrir={aoAbrir} compacto />
      ))}
    </div>
  );
}

/**
 * Um evento na grade ou na lista. É botão, não texto: o clique abre os
 * detalhes (descrição, link e, para quem administra, editar e excluir).
 */
function Evento({
  ocorrencia: o,
  aoAbrir,
  compacto = false,
}: {
  ocorrencia: Ocorrencia;
  aoAbrir: (o: Ocorrencia) => void;
  compacto?: boolean;
}) {
  const { live } = o;
  return (
    <button
      type="button"
      onClick={() => aoAbrir(o)}
      className={cn(
        "focus-visible:ring-ring w-full rounded-md text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        compacto ? "px-1.5 py-1 text-xs" : "px-2 py-1.5 text-sm",
        live.destaque
          ? "border-caution/50 bg-caution/15 hover:bg-caution/25 border"
          : "hover:bg-secondary/60",
      )}
    >
      {/* Texto corrido, não flex: um apresentador longo quebra a linha, como
          na grade impressa, em vez de ser cortado com reticências. */}
      <span className="block font-medium break-words">
        {o.aoVivo ? (
          <span
            className="bg-caution mr-1 inline-block size-1.5 rounded-full align-middle motion-safe:animate-pulse"
            aria-label="Ao vivo"
          />
        ) : null}
        {live.destaque ? (
          <Star className="text-caution float-right ml-1 size-3" aria-label="Destaque" />
        ) : null}
        <span className="tabular-nums">{horaCurta(o.quando)}</span>
        {live.apresentador ? ` · ${live.apresentador}` : null}
      </span>
      <span className={cn("text-muted-foreground block", compacto && "line-clamp-2")}>{live.titulo}</span>
    </button>
  );
}

function Detalhes({
  ocorrencia,
  ehAdmin,
  aoFechar,
}: {
  ocorrencia: Ocorrencia | null;
  ehAdmin: boolean;
  aoFechar: () => void;
}) {
  const { acoes } = useDados();
  const [erro, setErro] = useState<string | null>(null);
  const live = ocorrencia?.live;

  return (
    <Dialog
      open={ocorrencia !== null}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setErro(null);
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {ocorrencia && live ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {live.destaque ? <Star className="text-caution size-4" aria-label="Destaque" /> : null}
                {live.titulo}
              </DialogTitle>
              <DialogDescription>
                {live.apresentador ? `${live.apresentador} · ` : ""}
                {formatarQuando(ocorrencia.quando)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              {live.recorrencia !== "nenhuma" ? (
                <p className="text-muted-foreground inline-flex items-center gap-1.5">
                  <Repeat className="size-3.5" aria-hidden="true" />
                  {ROTULO_RECORRENCIA[live.recorrencia]}
                  {live.repetirAte
                    ? `, até ${live.repetirAte.split("-").reverse().join("/")}`
                    : ", sem data final"}
                </p>
              ) : null}
              {ocorrencia.aoVivo ? (
                <p className="text-caution font-medium">Ao vivo agora</p>
              ) : null}
              {live.descricao ? <p className="whitespace-pre-line">{live.descricao}</p> : null}
              {live.link ? (
                <a
                  href={live.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border hover:border-brand/50 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {ocorrencia.aoVivo ? "Assistir agora" : "Abrir link"}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              ) : null}
              {erro ? (
                <p role="alert" className="border-negative/30 bg-negative/5 text-negative rounded-md border px-3 py-2">
                  {erro}
                </p>
              ) : null}
            </div>

            {ehAdmin ? (
              <div className="border-border flex items-center justify-end gap-1 border-t pt-3">
                <EditarLive live={live} />
                <ConfirmarExclusao
                  titulo="Excluir live"
                  alvo={live.titulo}
                  impacto={live.recorrencia === "nenhuma" ? null : "todas as datas dela"}
                  aoConfirmar={async () => {
                    const falha = await acoes.excluirLive(live.id);
                    if (falha) {
                      setErro(Object.values(falha)[0] ?? "Não foi possível excluir.");
                    } else {
                      aoFechar();
                    }
                  }}
                  gatilho={<BotaoLixeira rotulo={`Excluir ${live.titulo}`} />}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
