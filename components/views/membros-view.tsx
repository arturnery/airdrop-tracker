"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Copy, KeyRound, ShieldCheck, Undo2, X } from "lucide-react";

import { reabrirMembro, redefinirSenhaDeMembro, revisarMembro } from "@/actions";
import { ConfirmarExclusao } from "@/components/forms/confirmar-exclusao";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { resumirMembros } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import type { MemberRow, MemberStatus } from "@/lib/types";

/**
 * Área do administrador: quem pediu acesso e quem já tem.
 *
 * Em produção esta rota exige papel de administrador: a verificação acontece
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
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, iniciar] = useTransition();

  const decidir = (status: "aprovado" | "recusado", note: string | null) =>
    iniciar(async () => {
      await revisarMembro({ id: membro.id, status, note });
    });

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
            <Button
              size="sm"
              disabled={enviando}
              onClick={() => decidir("aprovado", null)}
            >
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
              disabled={enviando}
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

/**
 * Redefinição de senha pelo administrador.
 *
 * A senha aparece uma única vez, num diálogo: o banco guarda só o hash, então
 * não há como consultá-la depois. Se sumir da tela antes de ser copiada, gera-se
 * outra. O diálogo evita espremer a senha dentro da célula da tabela, onde ela
 * ficaria difícil de ler e de copiar.
 */
function RedefinirSenha({ membro }: { membro: MemberRow }) {
  const [senha, setSenha] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [gerando, iniciar] = useTransition();

  const gerar = () =>
    iniciar(async () => {
      const resultado = await redefinirSenhaDeMembro(membro.id);
      if (resultado.ok) {
        setSenha(resultado.senha);
        setErro(null);
        setCopiada(false);
      } else {
        setErro(resultado.erro);
        setSenha(null);
      }
    });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        disabled={gerando}
        onClick={gerar}
        title={`Gerar senha temporária para ${membro.nome}`}
      >
        <KeyRound className="size-3.5" aria-hidden="true" />
        Redefinir senha
      </Button>

      <Dialog
        open={senha !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setSenha(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha temporária</DialogTitle>
            <DialogDescription>
              Para {membro.nome}. Aparece só agora: o sistema guarda apenas o
              hash, então não dá para consultá-la depois.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <code className="bg-secondary flex-1 rounded-md px-3 py-2.5 text-center font-mono text-lg tracking-wider select-all">
              {senha}
            </code>
            <Button
              variant="outline"
              onClick={() => {
                if (senha) void navigator.clipboard.writeText(senha);
                setCopiada(true);
              }}
            >
              <Copy className="size-4" aria-hidden="true" />
              {copiada ? "Copiada" : "Copiar"}
            </Button>
          </div>

          <p className="text-muted-foreground text-sm">
            Entregue por Discord ou WhatsApp e peça para trocar depois de entrar.
            A senha antiga deixou de valer.
          </p>

          <DialogFooter>
            <Button onClick={() => setSenha(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {erro ? (
        <p role="alert" className="text-negative text-xs">
          {erro}
        </p>
      ) : null}
    </>
  );
}

export function MembrosView({
  membros: todos,
  hoje,
}: {
  membros: MemberRow[];
  hoje: string;
}) {
  const [busca, setBusca] = useState("");
  const resumo = resumirMembros(todos);

  const filtrar = (lista: MemberRow[]) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (m) =>
        m.nome.toLowerCase().includes(termo) || m.email.toLowerCase().includes(termo),
    );
  };

  const pedindoSenha = todos.filter((m) => m.pedidoSenhaEm !== null);
  const pendentes = filtrar(todos.filter((m) => m.status === "pendente"));
  const aprovados = filtrar(todos.filter((m) => m.status === "aprovado"));
  const recusados = filtrar(todos.filter((m) => m.status === "recusado"));

  return (
    <>
      <PageHeader
        title="Membros"
        description="Quem pediu acesso e quem já tem. Aprovações são manuais."
      />

      <section aria-label="Resumo de membros" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <StatCard
          label="Pedidos de senha"
          accent={pedindoSenha.length > 0 ? "caution" : "idle"}
          value={<span className="tabular">{pedindoSenha.length}</span>}
          hint={
            pedindoSenha.length > 0
              ? "aguardando senha temporária"
              : "ninguém esqueceu a senha"
          }
        />
      </section>

      {/*
        Quem pediu redefinição aparece em destaque, no topo: é o único item
        desta tela em que alguém está travado do lado de fora esperando uma
        ação. Some da lista assim que a senha é gerada.
      */}
      {pedindoSenha.length > 0 ? (
        <section
          aria-labelledby="titulo-pedidos-senha"
          className="border-caution/40 bg-caution/5 mt-8 rounded-lg border p-4"
        >
          <h2
            id="titulo-pedidos-senha"
            className="mb-1 flex items-baseline gap-2 text-sm font-medium"
          >
            Pediram redefinição de senha
            <span className="text-muted-foreground tabular text-xs">
              {pedindoSenha.length}
            </span>
          </h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Gere a senha temporária e envie por e-mail. Quem entrar com ela terá
            de definir a própria antes de usar o sistema.
          </p>
          <ul className="space-y-2">
            {pedindoSenha.map((membro) => (
              <li
                key={`pedido-${membro.id}`}
                className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <span className="text-sm">
                  {membro.nome}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {membro.email}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    pediu em {formatDateBr(membro.pedidoSenhaEm!)}
                  </span>
                </span>
                <RedefinirSenha membro={membro} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
                      {membro.revisadoEm ? formatDateBr(membro.revisadoEm) : "-"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <RedefinirSenha membro={membro} />
                        <ConfirmarExclusao
                          titulo="Revogar acesso"
                          alvo={membro.nome}
                          impacto="A pessoa volta para a fila e perde o acesso até ser aprovada de novo"
                          aoConfirmar={() => reabrirMembro(membro.id)}
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
                    onClick={() => reabrirMembro(membro.id)}
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
