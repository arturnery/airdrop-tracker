"use client";

import { useState } from "react";
import { Check, Clock, ShieldCheck, Undo2, X } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { selectMembros, selectResumoMembros } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import type { MemberRow, MemberStatus } from "@/lib/types";

/**
 * Área do administrador: quem pediu acesso e quem já tem.
 *
 * Em produção esta rota exige papel de administrador — a verificação acontece
 * no servidor, não escondendo o link (ARCHITECTURE.md §9.3). Aqui não há
 * sessão, então a tela está aberta.
 */

const rotuloStatus: Record<MemberStatus, string> = {
  pendente: "Aguardando",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const estiloStatus: Record<MemberStatus, string> = {
  pendente: "border-caution/40 text-caution bg-caution/10",
  aprovado: "border-positive/40 text-positive bg-positive/10",
  recusado: "border-border text-muted-foreground",
};

function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        estiloStatus[status],
      )}
    >
      {rotuloStatus[status]}
    </span>
  );
}

/** Linha de um cadastro aguardando decisão. */
function LinhaPendente({ membro, hoje }: { membro: MemberRow; hoje: string }) {
  const { acoes } = useDados();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const decidir = (status: "aprovado" | "recusado", note: string | null) =>
    acoes.revisarMembro(membro.id, { status, note, revisadoEm: hoje });

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{membro.nome}</p>
          {/* O e-mail é o dado que se confere contra a lista de assinantes,
              então fica legível em vez de truncado. */}
          <p className="text-muted-foreground mt-0.5 font-mono text-xs break-all">
            {membro.email}
          </p>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <Clock className="size-3" aria-hidden="true" />
            cadastrou {relativeLabel(membro.cadastradoEm, hoje)}
            {membro.diasEsperando >= 3 ? (
              <span className="text-caution">· esperando há {membro.diasEsperando} dias</span>
            ) : null}
          </p>
        </div>

        {recusando ? null : (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => decidir("aprovado", null)}>
              <Check className="size-4" aria-hidden="true" />
              Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRecusando(true)}>
              <X className="size-4" aria-hidden="true" />
              Recusar
            </Button>
          </div>
        )}
      </div>

      {recusando ? (
        <div className="border-border mt-3 rounded-md border p-3">
          <label htmlFor={`motivo-${membro.id}`} className="text-sm">
            Por que está recusando?
          </label>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Fica registrado para você lembrar depois. A pessoa não vê.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              id={`motivo-${membro.id}`}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Sem assinatura ativa"
              className="min-w-48 flex-1"
              autoFocus
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={() => decidir("recusado", motivo.trim() || null)}
            >
              Confirmar recusa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRecusando(false);
                setMotivo("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function MembrosView() {
  const { dataset, hoje, acoes } = useDados();
  const [busca, setBusca] = useState("");

  const todos = selectMembros(dataset, hoje);
  const resumo = selectResumoMembros(dataset, hoje);

  const filtrar = (lista: MemberRow[]) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (m) =>
        m.nome.toLowerCase().includes(termo) || m.email.toLowerCase().includes(termo),
    );
  };

  const pendentes = filtrar(todos.filter((m) => m.status === "pendente"));
  const aprovados = filtrar(todos.filter((m) => m.status === "aprovado"));
  const recusados = filtrar(todos.filter((m) => m.status === "recusado"));

  return (
    <>
      <PageHeader
        title="Membros"
        description="Quem pediu acesso e quem já tem. Aprovações são manuais."
      />

      <section aria-label="Resumo de membros" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Aguardando"
          accent={resumo.pendentes > 0 ? "caution" : "idle"}
          value={<span className="tabular">{resumo.pendentes}</span>}
          hint={
            resumo.esperaMaisLonga !== null
              ? `mais antigo esperando há ${resumo.esperaMaisLonga} dias`
              : "nenhum cadastro na fila"
          }
        />
        <StatCard
          label="Com acesso"
          accent="positive"
          value={<span className="tabular">{resumo.aprovados}</span>}
          hint="membros aprovados"
        />
        <StatCard
          label="Recusados"
          accent="idle"
          value={<span className="tabular">{resumo.recusados}</span>}
          hint="ficam no histórico"
        />
      </section>

      {todos.length > 3 ? (
        <div className="mt-8">
          <label htmlFor="busca-membro" className="sr-only">
            Buscar por nome ou e-mail
          </label>
          <Input
            id="busca-membro"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="max-w-sm"
          />
        </div>
      ) : null}

      {/* ------------------------------------------------------------ fila */}
      <section aria-labelledby="titulo-pendentes" className="mt-8">
        <h2
          id="titulo-pendentes"
          className="mb-3 flex items-baseline gap-2 text-sm font-medium"
        >
          Aguardando aprovação
          <span className="text-muted-foreground tabular text-xs">
            {pendentes.length}
          </span>
        </h2>

        {pendentes.length === 0 ? (
          <EmptyState
            title="Nenhum cadastro na fila"
            description="Quando alguém criar conta, aparece aqui para você liberar ou recusar."
          />
        ) : (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {pendentes.map((membro) => (
              <LinhaPendente key={membro.id} membro={membro} hoje={hoje} />
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------- aprovados */}
      {aprovados.length > 0 ? (
        <section aria-labelledby="titulo-aprovados" className="mt-10">
          <h2
            id="titulo-aprovados"
            className="mb-3 flex items-baseline gap-2 text-sm font-medium"
          >
            <ShieldCheck className="text-positive size-4" aria-hidden="true" />
            Com acesso
            <span className="text-muted-foreground tabular text-xs">
              {aprovados.length}
            </span>
          </h2>

          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-160 text-sm">
              <caption className="sr-only">Membros com acesso liberado</caption>
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs">
                  <th scope="col" className="px-4 py-2.5 font-medium">Nome</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">E-mail</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Aprovado</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {aprovados.map((membro) => (
                  <tr key={membro.id} className="hover:bg-accent/40 transition-colors">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {membro.nome}
                    </th>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                      {membro.email}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {membro.revisadoEm ? formatDateBr(membro.revisadoEm) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end">
                        <ConfirmarExclusao
                          titulo="Revogar acesso"
                          alvo={membro.nome}
                          impacto="A pessoa volta para a fila e perde o acesso até ser aprovada de novo"
                          aoConfirmar={() => acoes.reabrirMembro(membro.id)}
                          gatilho={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="hover:text-negative h-8"
                            >
                              Revogar
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- recusados */}
      {recusados.length > 0 ? (
        <section aria-labelledby="titulo-recusados" className="mt-10">
          <h2
            id="titulo-recusados"
            className="text-muted-foreground mb-1 flex items-baseline gap-2 text-sm font-medium"
          >
            Recusados
            <span className="tabular text-xs">{recusados.length}</span>
          </h2>
          <p className="text-muted-foreground mb-3 text-xs">
            Ficam registrados para não voltarem à fila como cadastro novo.
          </p>

          <ul className="border-border divide-border divide-y rounded-lg border">
            {recusados.map((membro) => (
              <li
                key={membro.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm">
                    {membro.nome}
                    <span className="ml-2 font-mono text-xs">{membro.email}</span>
                  </p>
                  {membro.nota ? (
                    <p className="text-muted-foreground mt-0.5 text-xs italic">
                      {membro.nota}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={membro.status} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => acoes.reabrirMembro(membro.id)}
                  >
                    <Undo2 className="size-3.5" aria-hidden="true" />
                    Reconsiderar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
