"use client";

import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { CampoArea, CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  erros,
  lancamentoSchema,
  projetoSchema,
  saldoSchema,
  tarefaSchema,
  vinculoSchema,
  contaSchema,
} from "@/lib/validators";

/**
 * Formulários de edição.
 *
 * Cada um recebe o registro atual e pré-preenche os campos. A validação usa os
 * mesmos schemas do cadastro — um campo que é obrigatório ao criar continua
 * obrigatório ao editar, sem regra duplicada.
 */

type Erros = Record<string, string>;

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "");
const nulo = (valor: string) => (valor === "" ? null : valor);

function DialogoEdicao({
  titulo,
  descricao,
  children,
  aoEnviar,
  rotuloGatilho,
}: {
  titulo: string;
  descricao?: string;
  children: (props: { erros: Erros }) => ReactNode;
  aoEnviar: (dados: FormData) => Erros | null;
  rotuloGatilho: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [problemas, setProblemas] = useState<Erros>({});

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        setAberto(estado);
        if (!estado) setProblemas({});
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={rotuloGatilho}
          title={rotuloGatilho}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : null}
        </DialogHeader>
        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            const resultado = aoEnviar(new FormData(evento.currentTarget));
            if (resultado) {
              setProblemas(resultado);
              return;
            }
            setProblemas({});
            setAberto(false);
          }}
          className="space-y-4"
        >
          {children({ erros: problemas })}
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------- projeto

export function EditarProjeto({ projectId }: { projectId: string }) {
  const { dataset, acoes } = useDados();
  const projeto = dataset.projects.find((p) => p.id === projectId);
  if (!projeto) return null;

  return (
    <DialogoEdicao
      titulo="Editar projeto"
      rotuloGatilho={`Editar ${projeto.name}`}
      aoEnviar={(dados) => {
        const resultado = projetoSchema.safeParse({
          name: texto(dados, "name"),
          status: texto(dados, "status"),
          category: texto(dados, "category"),
          pointsLabel: texto(dados, "pointsLabel"),
          chain: texto(dados, "chain"),
          priority: texto(dados, "priority"),
          websiteUrl: texto(dados, "websiteUrl"),
          discordUrl: texto(dados, "discordUrl"),
          twitterUrl: texto(dados, "twitterUrl"),
          docsUrl: texto(dados, "docsUrl"),
          expectedTgeDate: texto(dados, "expectedTgeDate"),
          notes: texto(dados, "notes"),
        });
        if (!resultado.success) return erros(resultado);
        // O slug não muda: ele está na URL e em links já compartilhados.
        acoes.atualizarProjeto(projectId, resultado.data);
        return null;
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Nome"
            name="name"
            obrigatorio
            defaultValue={projeto.name}
            erro={e.name}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelecao
              label="Status"
              name="status"
              defaultValue={projeto.status}
              erro={e.status}
              opcoes={[
                { valor: "pesquisando", rotulo: "Pesquisando" },
                { valor: "ativo", rotulo: "Ativo" },
                { valor: "pausado", rotulo: "Pausado" },
                { valor: "tge_anunciado", rotulo: "TGE anunciado" },
                { valor: "distribuido", rotulo: "Distribuído" },
                { valor: "descartado", rotulo: "Descartado" },
              ]}
            />
            <CampoSelecao
              label="Categoria"
              name="category"
              defaultValue={projeto.category ?? "interacoes"}
              erro={e.category}
              ajuda="Como esse projeto é farmado."
              opcoes={[
                { valor: "liquidez", rotulo: "Liquidez (farm passivo)" },
                { valor: "interacoes", rotulo: "Interações semanais" },
                { valor: "perps", rotulo: "Perps" },
              ]}
            />
            <CampoSelecao
              label="Prioridade"
              name="priority"
              defaultValue={String(projeto.priority)}
              erro={e.priority}
              opcoes={[1, 2, 3, 4, 5].map((n) => ({
                valor: String(n),
                rotulo: String(n),
              }))}
            />
          </div>
          <CampoTexto
            label="Programa de pontos"
            name="pointsLabel"
            defaultValue={projeto.pointsLabel ?? ""}
            erro={e.pointsLabel}
            ajuda="Nome do programa (Pontos, XP, Marks). Em branco = o projeto não tem."
            placeholder="Pontos"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Rede"
              name="chain"
              defaultValue={projeto.chain ?? ""}
              erro={e.chain}
            />
            <CampoTexto
              label="TGE previsto"
              name="expectedTgeDate"
              type="date"
              defaultValue={projeto.expectedTgeDate ?? ""}
              erro={e.expectedTgeDate}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Site"
              name="websiteUrl"
              type="url"
              defaultValue={projeto.websiteUrl ?? ""}
              erro={e.websiteUrl}
            />
            <CampoTexto
              label="Twitter"
              name="twitterUrl"
              type="url"
              defaultValue={projeto.twitterUrl ?? ""}
              erro={e.twitterUrl}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Discord"
              name="discordUrl"
              type="url"
              defaultValue={projeto.discordUrl ?? ""}
              erro={e.discordUrl}
            />
            <CampoTexto
              label="Docs"
              name="docsUrl"
              type="url"
              defaultValue={projeto.docsUrl ?? ""}
              erro={e.docsUrl}
            />
          </div>
          <CampoArea
            label="Anotações"
            name="notes"
            defaultValue={projeto.notes ?? ""}
            erro={e.notes}
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// --------------------------------------------------------------------- conta

export function EditarConta({ accountId }: { accountId: string }) {
  const { dataset, acoes } = useDados();
  const conta = dataset.accounts.find((a) => a.id === accountId);
  if (!conta) return null;

  return (
    <DialogoEdicao
      titulo="Editar conta"
      rotuloGatilho={`Editar ${conta.label}`}
      aoEnviar={(dados) => {
        const resultado = contaSchema.safeParse({
          label: texto(dados, "label"),
          walletAddress: texto(dados, "walletAddress"),
          email: texto(dados, "email"),
        });
        if (!resultado.success) return erros(resultado);
        acoes.atualizarConta(accountId, {
          ...resultado.data,
          isActive: texto(dados, "isActive") === "sim",
        });
        return null;
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Identificação"
            name="label"
            obrigatorio
            defaultValue={conta.label}
            erro={e.label}
          />
          <CampoTexto
            label="Endereço da carteira"
            name="walletAddress"
            defaultValue={conta.walletAddress ?? ""}
            erro={e.walletAddress}
          />
          <CampoTexto
            label="E-mail"
            name="email"
            type="email"
            defaultValue={conta.email ?? ""}
            erro={e.email}
          />
          <CampoSelecao
            label="Situação"
            name="isActive"
            defaultValue={conta.isActive ? "sim" : "nao"}
            opcoes={[
              { valor: "sim", rotulo: "Ativa" },
              { valor: "nao", rotulo: "Inativa" },
            ]}
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// ---------------------------------------------------------------- lançamento

export function EditarLancamento({ transactionId }: { transactionId: string }) {
  const { dataset, acoes } = useDados();
  const lancamento = dataset.transactions.find((t) => t.id === transactionId);
  if (!lancamento) return null;

  return (
    <DialogoEdicao
      titulo="Editar lançamento"
      rotuloGatilho="Editar lançamento"
      aoEnviar={(dados) => {
        const resultado = lancamentoSchema.safeParse({
          projectId: lancamento.projectId,
          accountId: lancamento.accountId,
          occurredAt: texto(dados, "occurredAt"),
          type: texto(dados, "type"),
          amount: texto(dados, "amount"),
          description: texto(dados, "description"),
        });
        if (!resultado.success) return erros(resultado);
        acoes.atualizarLancamento(transactionId, {
          occurredAt: resultado.data.occurredAt,
          type: resultado.data.type,
          amount: resultado.data.amount,
          description: resultado.data.description,
        });
        return null;
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Tipo"
              name="type"
              defaultValue={lancamento.type}
              erro={e.type}
              opcoes={[
                { valor: "deposit", rotulo: "Depósito" },
                { valor: "withdrawal", rotulo: "Retirada" },
                { valor: "trade_pnl", rotulo: "Resultado de trade" },
                { valor: "fee_gas", rotulo: "Taxa / gas" },
                { valor: "volume_traded", rotulo: "Volume operado" },
                { valor: "other", rotulo: "Outro" },
              ]}
            />
            <CampoTexto
              label="Data"
              name="occurredAt"
              type="date"
              obrigatorio
              defaultValue={lancamento.occurredAt}
              erro={e.occurredAt}
            />
          </div>
          <CampoTexto
            label="Valor"
            name="amount"
            obrigatorio
            defaultValue={lancamento.amountUsd}
            erro={e.amount}
            inputMode="decimal"
          />
          <CampoTexto
            label="Descrição"
            name="description"
            defaultValue={lancamento.description ?? ""}
            erro={e.description}
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// --------------------------------------------------------------------- saldo

export function EditarSaldo({ snapshotId }: { snapshotId: string }) {
  const { dataset, acoes } = useDados();
  const saldo = dataset.balanceSnapshots.find((s) => s.id === snapshotId);
  if (!saldo) return null;

  return (
    <DialogoEdicao
      titulo="Editar saldo registrado"
      rotuloGatilho="Editar saldo"
      aoEnviar={(dados) => {
        const resultado = saldoSchema.safeParse({
          projectId: saldo.projectId,
          accountId: saldo.accountId,
          takenAt: texto(dados, "takenAt"),
          balance: texto(dados, "balance"),
          note: texto(dados, "note"),
        });
        if (!resultado.success) return erros(resultado);
        acoes.atualizarSaldo(snapshotId, {
          takenAt: resultado.data.takenAt,
          balance: resultado.data.balance,
          note: resultado.data.note,
        });
        return null;
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Data"
              name="takenAt"
              type="date"
              obrigatorio
              defaultValue={saldo.takenAt}
              erro={e.takenAt}
            />
            <CampoTexto
              label="Saldo"
              name="balance"
              obrigatorio
              defaultValue={saldo.balanceUsd}
              erro={e.balance}
              inputMode="decimal"
            />
          </div>
          <CampoTexto
            label="O que mudou"
            name="note"
            defaultValue={saldo.note ?? ""}
            erro={e.note}
            ajuda="Explica a variação em relação ao saldo anterior."
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// ------------------------------------------------------------------- vínculo

export function EditarVinculo({
  projectId,
  accountId,
}: {
  projectId: string;
  accountId: string;
}) {
  const { dataset, acoes } = useDados();
  const vinculo = dataset.projectAccounts.find(
    (p) => p.projectId === projectId && p.accountId === accountId,
  );
  const conta = dataset.accounts.find((a) => a.id === accountId);
  if (!vinculo || !conta) return null;

  return (
    <DialogoEdicao
      titulo="Editar vínculo"
      descricao={`Situação da conta ${conta.label} neste projeto.`}
      rotuloGatilho={`Editar vínculo de ${conta.label}`}
      aoEnviar={(dados) => {
        const resultado = vinculoSchema.safeParse({
          projectId,
          accountId,
          status: texto(dados, "status"),
          startedAt: texto(dados, "startedAt"),
        });
        if (!resultado.success) return erros(resultado);
        acoes.atualizarVinculo(projectId, accountId, {
          status: resultado.data.status,
          startedAt: resultado.data.startedAt,
        });
        return null;
      }}
    >
      {({ erros: e }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelecao
            label="Situação"
            name="status"
            defaultValue={vinculo.status}
            erro={e.status}
            opcoes={[
              { valor: "ativa", rotulo: "Ativa" },
              { valor: "pausada", rotulo: "Pausada" },
              { valor: "queimada", rotulo: "Queimada" },
            ]}
          />
          <CampoTexto
            label="Início"
            name="startedAt"
            type="date"
            obrigatorio
            defaultValue={vinculo.startedAt}
            erro={e.startedAt}
          />
        </div>
      )}
    </DialogoEdicao>
  );
}

// -------------------------------------------------------------------- tarefa

export function EditarTarefa({ taskId }: { taskId: string }) {
  const { dataset, acoes } = useDados();
  const tarefa = dataset.tasks.find((t) => t.id === taskId);
  if (!tarefa) return null;

  const contas: { valor: string; rotulo: string }[] = [
    { valor: "", rotulo: "Todas as contas" },
    ...dataset.accounts.map((a) => ({ valor: a.id, rotulo: a.label })),
  ];

  return (
    <DialogoEdicao
      titulo="Editar tarefa"
      rotuloGatilho={`Editar ${tarefa.title}`}
      aoEnviar={(dados) => {
        const resultado = tarefaSchema.safeParse({
          projectId: tarefa.projectId,
          accountId: nulo(texto(dados, "accountId")),
          title: texto(dados, "title"),
          description: texto(dados, "description"),
          recurrence: texto(dados, "recurrence"),
          intervalDays: nulo(texto(dados, "intervalDays")),
          dueDate: texto(dados, "dueDate"),
        });
        if (!resultado.success) return erros(resultado);
        acoes.atualizarTarefa(taskId, {
          title: resultado.data.title,
          description: resultado.data.description,
          recurrence: resultado.data.recurrence,
          intervalDays: resultado.data.intervalDays,
          dueDate: resultado.data.dueDate,
          accountId: resultado.data.accountId,
          isActive: texto(dados, "isActive") === "sim",
        });
        return null;
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Tarefa"
            name="title"
            obrigatorio
            defaultValue={tarefa.title}
            erro={e.title}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Conta"
              name="accountId"
              defaultValue={tarefa.accountId ?? ""}
              erro={e.accountId}
              opcoes={contas}
            />
            <CampoSelecao
              label="Ativa"
              name="isActive"
              defaultValue={tarefa.isActive ? "sim" : "nao"}
              ajuda="Inativa some das listas sem apagar o histórico."
              opcoes={[
                { valor: "sim", rotulo: "Sim" },
                { valor: "nao", rotulo: "Não" },
              ]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelecao
              label="Repetição"
              name="recurrence"
              defaultValue={tarefa.recurrence}
              erro={e.recurrence}
              opcoes={[
                { valor: "none", rotulo: "Prazo fixo" },
                { valor: "daily", rotulo: "Diária" },
                { valor: "weekly", rotulo: "Semanal" },
                { valor: "monthly", rotulo: "Mensal" },
                { valor: "every_n_days", rotulo: "A cada N dias" },
              ]}
            />
            <CampoTexto
              label="Intervalo (dias)"
              name="intervalDays"
              type="number"
              min={1}
              defaultValue={tarefa.intervalDays ?? ""}
              erro={e.intervalDays}
            />
            <CampoTexto
              label="Vencimento"
              name="dueDate"
              type="date"
              defaultValue={tarefa.dueDate ?? ""}
              erro={e.dueDate}
            />
          </div>
          <CampoArea
            label="Descrição"
            name="description"
            defaultValue={tarefa.description ?? ""}
            erro={e.description}
          />
        </>
      )}
    </DialogoEdicao>
  );
}
