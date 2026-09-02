"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Pencil } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { CampoValorToken } from "@/components/forms/campo-valor-token";
import { CampoArea, CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { CampoData } from "@/components/forms/campo-data";
import { CampoValor } from "@/components/forms/campo-valor";
import { contasDisponiveisNoProjeto } from "@/lib/tarefas";
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
  metaSchema,
  pontosSchema,
  progressoMetaSchema,
  projetoSchema,
  recebimentoSchema,
  tarefaSchema,
  vinculoSchema,
  contaSchema,
  volumeSchema,
} from "@/lib/validators";
import { TIPOS_LANCAMENTO } from "@/lib/finance";
import {
  formatUsd,
  fromDbNumeric,
  semZerosDeSobra,
  toDbNumeric,
} from "@/lib/money";
import { fromDbPoints, toDbPoints } from "@/lib/points";

/**
 * Contas oferecidas para um projeto: as vinculadas a ele, ou todas enquanto não
 * houver vínculo. Mesma regra dos formulários de cadastro.
 */
function contasDoProjeto(
  dataset: { projectAccounts: { projectId: string; accountId: string }[]; accounts: { id: string; label: string }[] },
  projectId: string,
) {
  const permitidas = new Set(
    contasDisponiveisNoProjeto(
      dataset.projectAccounts
        .filter((pa) => pa.projectId === projectId)
        .map((pa) => pa.accountId),
      dataset.accounts.map((a) => a.id),
    ),
  );
  return dataset.accounts
    .filter((a) => permitidas.has(a.id))
    .map((a) => ({ valor: a.id, rotulo: a.label }));
}

/**
 * Formulários de edição.
 *
 * Cada um recebe o registro atual e pré-preenche os campos. A validação usa os
 * mesmos schemas do cadastro: um campo que é obrigatório ao criar continua
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
  aoEnviar: (dados: FormData) => Promise<Erros | null> | Erros | null;
  rotuloGatilho: string;
}) {
  const { salvando } = useDados();
  const [aberto, setAberto] = useState(false);
  const [problemas, setProblemas] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  /*
   * Gravou, e agora espera a tela receber o dado antes de fechar.
   *
   * Fechar assim que o banco responde deixava um vão: o diálogo sumia e a
   * tabela continuava com o valor antigo por um instante, o bastante para
   * parecer que a alteração se perdeu. Agora o botão continua dizendo
   * "Salvando…" até o dado estar na tela, e quando o diálogo fecha o que
   * aparece atrás já é o resultado.
   */
  const [aguardandoTela, setAguardandoTela] = useState(false);

  /*
   * Ajuste durante a renderização, e não num efeito: é o padrão que o React
   * documenta para reagir a uma mudança de valor, e evita o render a mais que
   * um efeito custaria. O `if` só é verdadeiro no render em que a transição
   * termina, então não há laço.
   */
  if (aguardandoTela && !salvando) {
    setAguardandoTela(false);
    setAberto(false);
  }

  const ocupado = enviando || aguardandoTela;

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
          onSubmit={async (evento) => {
            evento.preventDefault();
            setEnviando(true);
            try {
              const resultado = await aoEnviar(new FormData(evento.currentTarget));
              if (resultado) {
                setProblemas(resultado);
                return;
              }
              setProblemas({});
              setAguardandoTela(true);
            } finally {
              setEnviando(false);
            }
          }}
          className="space-y-4"
        >
          {children({ erros: problemas })}

          {problemas.geral ? (
            <p
              role="alert"
              className="border-negative/30 bg-negative/5 text-negative rounded-md border px-3 py-2 text-sm"
            >
              {problemas.geral}
            </p>
          ) : null}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={ocupado}
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={ocupado}>
              {ocupado ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Salvando…
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
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
        /*
         * Envia o objeto BRUTO, não `resultado.data`. Os schemas têm
         * transform, "$3" vira 300 centavos, e a Server Action valida de
         * novo. Mandar o já transformado faria o schema receber número onde
         * espera string e recusar a própria saída.
         *
         * A validação aqui existe só para o retorno rápido ao usuário; a que
         * vale é a do servidor.
         */
        const bruto = {
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
        };
        const resultado = projetoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        // O slug não muda: ele está na URL e em links já compartilhados.
        acoes.atualizarProjeto(projectId, bruto);
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
            <CampoData
              label="TGE previsto"
              name="expectedTgeDate"
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
        const bruto = {
          label: texto(dados, "label"),
          walletAddress: texto(dados, "walletAddress"),
          email: texto(dados, "email"),
        };
        const resultado = contaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarConta(accountId, {
          ...bruto,
          isActive: texto(dados, "isActive") === "sim",
        });
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

  /*
   * As contas oferecidas são as do projeto do lançamento. O projeto em si não
   * muda por aqui: trocá-lo moveria dinheiro de um projeto para outro, o que
   * altera dois saldos de uma vez e é melhor feito apagando e relançando, com
   * o histórico mostrando o que aconteceu.
   */
  const contas = contasDoProjeto(dataset, lancamento?.projectId ?? "");

  if (!lancamento) return null;

  return (
    <DialogoEdicao
      titulo="Editar lançamento"
      rotuloGatilho="Editar lançamento"
      aoEnviar={(dados) => {
        const bruto = {
          projectId: lancamento.projectId,
          accountId: texto(dados, "accountId"),
          occurredAt: texto(dados, "occurredAt"),
          type: texto(dados, "type"),
          amount: texto(dados, "amount"),
          tokenSymbol: texto(dados, "tokenSymbol"),
          tokenAmount: texto(dados, "tokenAmount"),
          description: texto(dados, "description"),
        };
        const resultado = lancamentoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarLancamento(transactionId, bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoSelecao
            label="Conta"
            name="accountId"
            obrigatorio
            defaultValue={lancamento.accountId}
            erro={e.accountId}
            opcoes={contas}
            ajuda="Lançar na conta errada é o engano mais comum: dá para corrigir aqui."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Tipo"
              name="type"
              defaultValue={lancamento.type}
              erro={e.type}
              opcoes={[...TIPOS_LANCAMENTO]}
            />
            <CampoData
              label="Data"
              name="occurredAt"
              obrigatorio
              defaultValue={lancamento.occurredAt}
              erro={e.occurredAt}
            />
          </div>
          <CampoValorToken
            erros={e}
            valorInicial={lancamento.amountUsd}
            simboloInicial={lancamento.tokenSymbol ?? ""}
            quantidadeInicial={lancamento.tokenAmount ?? ""}
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
        const bruto = {
          projectId,
          accountId,
          status: texto(dados, "status"),
          startedAt: texto(dados, "startedAt"),
        };
        const resultado = vinculoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        // A action de vincular faz upsert, então serve para criar e editar.
        void acoes.vincularConta(bruto);
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
          <CampoData
            label="Início"
            name="startedAt"
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
  const [repeticao, setRepeticao] = useState<string>(
    tarefa?.recurrence ?? "daily",
  );
  if (!tarefa) return null;

  const contas: { valor: string; rotulo: string }[] = [
    { valor: "", rotulo: "Todas as contas" },
    ...contasDoProjeto(dataset, tarefa.projectId),
  ];

  return (
    <DialogoEdicao
      titulo="Editar tarefa"
      rotuloGatilho={`Editar ${tarefa.title}`}
      aoEnviar={(dados) => {
        const bruto = {
          projectId: tarefa.projectId,
          accountId: nulo(texto(dados, "accountId")),
          title: texto(dados, "title"),
          description: texto(dados, "description"),
          recurrence: texto(dados, "recurrence"),
          intervalDays: nulo(texto(dados, "intervalDays")),
          dueDate: texto(dados, "dueDate"),
        };
        const resultado = tarefaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarTarefa(taskId, {
          ...bruto,
          isActive: texto(dados, "isActive") === "sim",
        });
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
              onChange={(evento) => setRepeticao(evento.target.value)}
              opcoes={[
                { valor: "none", rotulo: "Prazo fixo" },
                { valor: "daily", rotulo: "Diária" },
                { valor: "weekly", rotulo: "Semanal" },
                { valor: "monthly", rotulo: "Mensal" },
                { valor: "every_n_days", rotulo: "A cada N dias" },
              ]}
            />
            {/* Só aparece para "a cada N dias": ver NovaTarefa. */}
            {repeticao === "every_n_days" ? (
              <CampoTexto
                label="A cada quantos dias?"
                name="intervalDays"
                type="number"
                min={1}
                obrigatorio
                defaultValue={tarefa.intervalDays ?? ""}
                erro={e.intervalDays}
              />
            ) : null}
            <CampoData
              label="Vencimento"
              name="dueDate"
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

// ---------------------------------------------------------------------- meta

export function EditarMeta({ goalId }: { goalId: string }) {
  const { dataset, acoes } = useDados();
  const meta = dataset.goals.find((g) => g.id === goalId);
  // O banco guarda numeric como string; o campo trabalha com o decimal.
  const [alvo, setAlvo] = useState(
    meta ? toDbNumeric(fromDbNumeric(meta.targetValue)) : "",
  );
  if (!meta) return null;

  const contas: { valor: string; rotulo: string }[] = [
    { valor: "", rotulo: "Todas as contas" },
    ...contasDoProjeto(dataset, meta.projectId),
  ];

  return (
    <DialogoEdicao
      titulo="Editar meta"
      rotuloGatilho={`Editar ${meta.title}`}
      aoEnviar={(dados) => {
        /*
         * `projectId` vai fixo, do registro. Mover a meta de projeto mudaria o
         * que ela mede: o valor atual é derivado dos lançamentos daquele
         * projeto, e a barra de progresso passaria a comparar coisas
         * diferentes. A Server Action também ignora qualquer projectId enviado.
         */
        const bruto = {
          projectId: meta.projectId,
          accountId: nulo(texto(dados, "accountId")),
          title: texto(dados, "title"),
          metric: texto(dados, "metric"),
          target: texto(dados, "target"),
          deadline: texto(dados, "deadline"),
        };
        const resultado = metaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarMeta(goalId, bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Meta"
            name="title"
            obrigatorio
            defaultValue={meta.title}
            erro={e.title}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelecao
              label="Métrica"
              name="metric"
              defaultValue={meta.metric}
              erro={e.metric}
              opcoes={[
                { valor: "volume_usd", rotulo: "Volume (USD)" },
                { valor: "balance_usd", rotulo: "Saldo (USD)" },
                { valor: "tx_count", rotulo: "Nº de transações" },
                { valor: "days_active", rotulo: "Dias ativos" },
              ]}
            />
            <CampoValor
              label="Alvo"
              name="target"
              obrigatorio
              valor={alvo}
              aoMudar={setAlvo}
              erro={e.target}
            />
            <CampoData
              label="Prazo"
              name="deadline"
              defaultValue={meta.deadline ?? ""}
              erro={e.deadline}
            />
          </div>
          <CampoSelecao
            label="Conta"
            name="accountId"
            defaultValue={meta.accountId ?? ""}
            erro={e.accountId}
            opcoes={contas}
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// -------------------------------------------------------- medição de volume

/**
 * Correção de uma medição de volume já registrada.
 *
 * Antes só havia apagar e lançar de novo, e numa série de acumulado isso não é
 * equivalente: apagar a medição do meio faz o ganho da seguinte passar a ser
 * medido contra a que veio antes dela, e um número que ninguém mexeu muda de
 * valor. Corrigir no lugar mantém a série.
 *
 * O campo mostra a mesma comparação do registro, com uma diferença que importa:
 * a medição anterior é a anterior **a esta**, e não a última da conta. Editar a
 * primeira de três precisa se comparar com o que vinha antes dela.
 */
export function EditarVolume({ snapshotId }: { snapshotId: string }) {
  const { dataset, acoes } = useDados();
  const medicao = dataset.volumeSnapshots.find((v) => v.id === snapshotId);
  const [valor, setValor] = useState(
    medicao ? toDbNumeric(fromDbNumeric(medicao.volumeUsd)) : "",
  );
  if (!medicao) return null;

  const anterior = dataset.volumeSnapshots
    .filter(
      (v) =>
        v.projectId === medicao.projectId &&
        v.accountId === medicao.accountId &&
        v.takenAt < medicao.takenAt,
    )
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .at(-1);

  return (
    <DialogoEdicao
      titulo="Editar medição de volume"
      descricao="O total acumulado que a plataforma mostrava nessa data."
      rotuloGatilho="Editar medição de volume"
      aoEnviar={(dados) => {
        const bruto = {
          projectId: medicao.projectId,
          accountId: texto(dados, "accountId"),
          takenAt: texto(dados, "takenAt"),
          volume: texto(dados, "volume"),
          note: texto(dados, "note"),
        };
        const resultado = volumeSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarVolume(snapshotId, bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoSelecao
            label="Conta"
            name="accountId"
            obrigatorio
            defaultValue={medicao.accountId}
            erro={e.accountId}
            opcoes={contasDoProjeto(dataset, medicao.projectId)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoValor
              label="Volume acumulado"
              name="volume"
              obrigatorio
              valor={valor}
              aoMudar={setValor}
              erro={e.volume}
              ajuda={
                anterior
                  ? `A medição anterior desta conta marcava ${formatUsd(fromDbNumeric(anterior.volumeUsd))}.`
                  : "É a primeira medição desta conta: não há base de comparação."
              }
            />
            <CampoData
              label="Data"
              name="takenAt"
              obrigatorio
              defaultValue={medicao.takenAt}
              erro={e.takenAt}
            />
          </div>
          <CampoTexto
            label="Nota"
            name="note"
            defaultValue={medicao.note ?? ""}
            erro={e.note}
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// -------------------------------------------------------- medição de pontos

/** Correção de uma medição de pontos. Mesma natureza da de volume. */
export function EditarPontos({ snapshotId }: { snapshotId: string }) {
  const { dataset, acoes } = useDados();
  const medicao = dataset.pointsSnapshots.find((p) => p.id === snapshotId);
  /*
   * `21.400` e não `21400.0000`: a coluna guarda quatro casas para o caso raro
   * de pontos fracionários, e mostrar os zeros obrigaria a apagá-los antes de
   * digitar o número novo.
   */
  const [pontos, setPontos] = useState(
    medicao ? semZerosDeSobra(toDbPoints(fromDbPoints(medicao.points))) : "",
  );
  if (!medicao) return null;

  return (
    <DialogoEdicao
      titulo="Editar medição de pontos"
      descricao="O total acumulado que o programa mostrava nessa data."
      rotuloGatilho="Editar medição de pontos"
      aoEnviar={(dados) => {
        const bruto = {
          projectId: medicao.projectId,
          accountId: texto(dados, "accountId"),
          takenAt: texto(dados, "takenAt"),
          points: texto(dados, "points"),
          note: texto(dados, "note"),
        };
        const resultado = pontosSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarPontos(snapshotId, bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoSelecao
            label="Conta"
            name="accountId"
            obrigatorio
            defaultValue={medicao.accountId}
            erro={e.accountId}
            opcoes={contasDoProjeto(dataset, medicao.projectId)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoValor
              label="Total acumulado"
              name="points"
              obrigatorio
              valor={pontos}
              aoMudar={setPontos}
              erro={e.points}
              ajuda="O número que a plataforma exibe, não o ganho."
              formato="pontos"
            />
            <CampoData
              label="Data"
              name="takenAt"
              obrigatorio
              defaultValue={medicao.takenAt}
              erro={e.takenAt}
            />
          </div>
          <CampoTexto
            label="Observação"
            name="note"
            defaultValue={medicao.note ?? ""}
            erro={e.note}
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// ------------------------------------------------------- progresso de meta

/**
 * Correção de um progresso lançado numa meta.
 *
 * A meta não muda: mover o progresso para outra meta mexeria em duas barras ao
 * mesmo tempo, e quem quer isso apaga aqui e lança lá, onde as duas mudanças
 * ficam visíveis.
 */
export function EditarProgressoMeta({ entryId }: { entryId: string }) {
  const { dataset, acoes } = useDados();
  const entrada = dataset.goalEntries.find((e) => e.id === entryId);
  const [valor, setValor] = useState(
    entrada ? toDbNumeric(fromDbNumeric(entrada.value)) : "",
  );
  if (!entrada) return null;

  const meta = dataset.goals.find((g) => g.id === entrada.goalId);

  return (
    <DialogoEdicao
      titulo="Editar lançamento da meta"
      descricao={meta ? `Progresso registrado em "${meta.title}".` : undefined}
      rotuloGatilho="Editar lançamento da meta"
      aoEnviar={(dados) => {
        const bruto = {
          goalId: entrada.goalId,
          occurredAt: texto(dados, "occurredAt"),
          value: texto(dados, "value"),
          note: texto(dados, "note"),
        };
        const resultado = progressoMetaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarProgressoMeta(entryId, bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoValor
              label="Quanto somar"
              name="value"
              obrigatorio
              valor={valor}
              aoMudar={setValor}
              erro={e.value}
              ajuda="Use o sinal de menos para corrigir um lançamento a mais."
            />
            <CampoData
              label="Data"
              name="occurredAt"
              obrigatorio
              defaultValue={entrada.occurredAt}
              erro={e.occurredAt}
            />
          </div>
          <CampoTexto
            label="Nota"
            name="note"
            defaultValue={entrada.note ?? ""}
            erro={e.note}
          />
        </>
      )}
    </DialogoEdicao>
  );
}

// --------------------------------------------------------------- recebimento

/**
 * Correção de um airdrop recebido.
 *
 * Começa no modo em que foi registrado: quem informou quantidade e preço vê os
 * dois campos, quem informou só o total vê o total. Trocar de modo é permitido,
 * e é metade do motivo desta tela existir: quem lançou "deu uns $75" e depois
 * descobriu a quantidade exata completava o registro apagando e refazendo.
 *
 * O valor em dólar não é campo quando o modo é token: ele sai da multiplicação,
 * na mesma função que o registro usa.
 */
export function EditarRecebimento({ claimId }: { claimId: string }) {
  const { dataset, acoes } = useDados();
  const claim = dataset.airdropClaims.find((c) => c.id === claimId);
  /*
   * Quantidade nula é a marca de "lançado direto em dólar": foi assim que o
   * registro decidiu não afirmar uma quantidade que ninguém informou.
   */
  const [modo, setModo] = useState<"token" | "total">(
    claim?.tokenAmount ? "token" : "total",
  );
  // A coluna tem dezoito casas decimais: sem a limpeza, corrigir a quantidade
  // começaria por apagar dezoito zeros.
  const [quantidade, setQuantidade] = useState(
    semZerosDeSobra(claim?.tokenAmount ?? ""),
  );
  const [precoToken, setPrecoToken] = useState(
    semZerosDeSobra(claim?.priceUsd ?? ""),
  );
  const [total, setTotal] = useState(
    claim ? toDbNumeric(fromDbNumeric(claim.valueUsd)) : "",
  );
  if (!claim) return null;

  return (
    <DialogoEdicao
      titulo="Editar recebimento"
      rotuloGatilho="Editar recebimento"
      aoEnviar={(dados) => {
        const bruto = {
          projectId: claim.projectId,
          accountId: texto(dados, "accountId"),
          receivedAt: texto(dados, "receivedAt"),
          tokenSymbol: texto(dados, "tokenSymbol"),
          modo,
          tokenAmount: texto(dados, "tokenAmount"),
          priceUsd: texto(dados, "priceUsd"),
          valueUsd: texto(dados, "valueUsd"),
        };
        const resultado = recebimentoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.atualizarRecebimento(claimId, bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoSelecao
            label="Conta"
            name="accountId"
            obrigatorio
            defaultValue={claim.accountId}
            erro={e.accountId}
            opcoes={contasDoProjeto(dataset, claim.projectId)}
          />
          <CampoSelecao
            label="Como informar"
            name="modo"
            value={modo}
            onChange={(evento) =>
              setModo(evento.target.value === "total" ? "total" : "token")
            }
            ajuda={
              modo === "token"
                ? "O valor em dólar sai da quantidade vezes o preço."
                : "Use quando o token já foi vendido ou você só tem o total."
            }
            opcoes={[
              { valor: "token", rotulo: "Quantidade e preço do token" },
              { valor: "total", rotulo: "Só o total em dólar" },
            ]}
          />

          {modo === "token" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <CampoTexto
                label="Token"
                name="tokenSymbol"
                obrigatorio
                defaultValue={claim.tokenSymbol}
                erro={e.tokenSymbol}
              />
              <CampoValor
                label="Quantidade"
                name="tokenAmount"
                obrigatorio
                valor={quantidade}
                aoMudar={setQuantidade}
                erro={e.tokenAmount}
                formato="quantidade"
              />
              <CampoValor
                label="Preço (USD)"
                name="priceUsd"
                obrigatorio
                valor={precoToken}
                aoMudar={setPrecoToken}
                erro={e.priceUsd}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                label="Token"
                name="tokenSymbol"
                obrigatorio
                defaultValue={claim.tokenSymbol}
                erro={e.tokenSymbol}
              />
              <CampoValor
                label="Total recebido (USD)"
                name="valueUsd"
                obrigatorio
                valor={total}
                aoMudar={setTotal}
                erro={e.valueUsd}
              />
            </div>
          )}
          <CampoData
            label="Data"
            name="receivedAt"
            obrigatorio
            defaultValue={claim.receivedAt}
            erro={e.receivedAt}
          />
        </>
      )}
    </DialogoEdicao>
  );
}
