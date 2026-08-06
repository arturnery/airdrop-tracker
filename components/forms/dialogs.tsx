"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";

import { CampoValorToken } from "@/components/forms/campo-valor-token";
import { CampoArea, CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { useDados } from "@/components/data-provider";
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
  contaSchema,
  erros,
  lancamentoSchema,
  metaSchema,
  pontosSchema,
  projetoSchema,
  recebimentoSchema,
  cotacaoSchema,
  tarefaSchema,
  vinculoSchema,
} from "@/lib/validators";

/**
 * Formulários de cadastro (modo local).
 *
 * Cada um valida com o schema Zod de `lib/validators` e só então chama a ação
 * do provider. Os mesmos schemas passarão a validar as Server Actions quando o
 * backend entrar, então a validação não é jogada fora.
 */

type Erros = Record<string, string>;

function Formulario({
  titulo,
  descricao,
  gatilho,
  children,
  aoEnviar,
  rotuloEnvio = "Salvar",
}: {
  titulo: string;
  descricao?: string;
  gatilho: ReactNode;
  children: (props: { erros: Erros }) => ReactNode;
  aoEnviar: (dados: FormData) => Promise<Erros | null> | Erros | null;
  rotuloEnvio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [problemas, setProblemas] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        setAberto(estado);
        if (!estado) setProblemas({});
      }}
    >
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : null}
        </DialogHeader>

        <form
          noValidate
          onSubmit={async (evento) => {
            evento.preventDefault();
            const dados = new FormData(evento.currentTarget);
            setEnviando(true);
            try {
              const resultado = await aoEnviar(dados);
              if (resultado) {
                setProblemas(resultado);
                return;
              }
              setProblemas({});
              setAberto(false);
            } finally {
              setEnviando(false);
            }
          }}
          className="space-y-4"
        >
          {children({ erros: problemas })}

          {/* Falha do servidor (banco fora, permissão) chega neste campo. */}
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
              disabled={enviando}
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Salvando…
                </>
              ) : (
                rotuloEnvio
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "");
const nulo = (valor: string) => (valor === "" ? null : valor);

/**
 * Precisa repassar `...props`: o DialogTrigger com `asChild` clona este
 * elemento e injeta onClick, aria-* e ref nele. Sem o spread, o clique é
 * descartado silenciosamente e o botão simplesmente não abre nada.
 */
function BotaoNovo({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button size="sm" {...props}>
      <Plus className="size-4" aria-hidden="true" />
      {children}
    </Button>
  );
}

// ------------------------------------------------------------------- projeto

export function NovoProjeto() {
  const { acoes } = useDados();

  return (
    <Formulario
      titulo="Novo projeto"
      descricao="Cadastre um airdrop que você está farmando."
      gatilho={<BotaoNovo>Novo projeto</BotaoNovo>}
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
        return acoes.criarProjeto(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Nome"
            name="name"
            obrigatorio
            erro={e.name}
            placeholder="Vertex Perp"
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelecao
              label="Status"
              name="status"
              defaultValue="ativo"
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
              defaultValue={"interacoes"}
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
              defaultValue="3"
              erro={e.priority}
              ajuda="1 = baixa, 5 = máxima"
              opcoes={[1, 2, 3, 4, 5].map((n) => ({
                valor: String(n),
                rotulo: String(n),
              }))}
            />
          </div>
          <CampoTexto
            label="Programa de pontos"
            name="pointsLabel"
            
            erro={e.pointsLabel}
            ajuda="Nome do programa (Pontos, XP, Marks). Em branco = o projeto não tem."
            placeholder="Pontos"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Rede"
              name="chain"
              erro={e.chain}
              placeholder="Arbitrum"
            />
            <CampoTexto
              label="TGE previsto"
              name="expectedTgeDate"
              type="date"
              erro={e.expectedTgeDate}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Site"
              name="websiteUrl"
              type="url"
              erro={e.websiteUrl}
              placeholder="https://"
            />
            <CampoTexto
              label="Twitter"
              name="twitterUrl"
              type="url"
              erro={e.twitterUrl}
              placeholder="https://"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Discord"
              name="discordUrl"
              type="url"
              erro={e.discordUrl}
              placeholder="https://"
            />
            <CampoTexto
              label="Docs"
              name="docsUrl"
              type="url"
              erro={e.docsUrl}
              placeholder="https://"
            />
          </div>
          <CampoArea
            label="Anotações"
            name="notes"
            erro={e.notes}
            placeholder="Tese do projeto, estratégia de farming…"
          />
        </>
      )}
    </Formulario>
  );
}

// --------------------------------------------------------------------- conta

export function NovaConta() {
  const { acoes } = useDados();

  return (
    <Formulario
      titulo="Nova conta"
      descricao="Uma carteira ou perfil de navegador, usada em quantos projetos você quiser."
      gatilho={<BotaoNovo>Nova conta</BotaoNovo>}
      aoEnviar={(dados) => {
        const resultado = contaSchema.safeParse({
          label: texto(dados, "label"),
          walletAddress: texto(dados, "walletAddress"),
          email: texto(dados, "email"),
        });
        if (!resultado.success) return erros(resultado);
        return acoes.criarConta(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Identificação"
            name="label"
            obrigatorio
            erro={e.label}
            ajuda="Como você chama essa conta no dia a dia."
            placeholder="chrome (Perfil 3)"
            autoFocus
          />
          <CampoTexto
            label="Endereço da carteira"
            name="walletAddress"
            erro={e.walletAddress}
            placeholder="0x…"
          />
          <CampoTexto
            label="E-mail"
            name="email"
            type="email"
            erro={e.email}
            placeholder="conta@exemplo.com"
          />
        </>
      )}
    </Formulario>
  );
}

// -------------------------------------------------------------------- seleto

function useOpcoes() {
  const { dataset } = useDados();
  return {
    projetos: dataset.projects.map((p) => ({ valor: p.id, rotulo: p.name })),
    contas: dataset.accounts.map((a) => ({ valor: a.id, rotulo: a.label })),
  };
}

// ---------------------------------------------------------------- lançamento

export function NovoLancamento({
  projectId,
  rotulo = "Novo lançamento",
}: {
  projectId?: string;
  rotulo?: string;
}) {
  const { acoes, hoje } = useDados();
  const { projetos, contas } = useOpcoes();

  return (
    <Formulario
      titulo="Novo lançamento"
      descricao="Depósito, retirada, resultado de trade ou volume operado."
      gatilho={<BotaoNovo>{rotulo}</BotaoNovo>}
      aoEnviar={(dados) => {
        const resultado = lancamentoSchema.safeParse({
          projectId: texto(dados, "projectId"),
          accountId: texto(dados, "accountId"),
          occurredAt: texto(dados, "occurredAt"),
          type: texto(dados, "type"),
          amount: texto(dados, "amount"),
          tokenSymbol: texto(dados, "tokenSymbol"),
          tokenAmount: texto(dados, "tokenAmount"),
          description: texto(dados, "description"),
        });
        if (!resultado.success) return erros(resultado);
        return acoes.criarLancamento(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Projeto"
              name="projectId"
              obrigatorio
              defaultValue={projectId}
              erro={e.projectId}
              opcoes={projetos}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              obrigatorio
              erro={e.accountId}
              opcoes={contas}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Tipo"
              name="type"
              defaultValue="deposit"
              erro={e.type}
              opcoes={[
                { valor: "deposit", rotulo: "Depósito" },
                { valor: "withdrawal", rotulo: "Retirada" },
                { valor: "yield", rotulo: "Rendimento" },
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
              defaultValue={hoje}
              erro={e.occurredAt}
            />
          </div>
          <CampoValorToken erros={e} />

          <CampoTexto
            label="Descrição"
            name="description"
            erro={e.description}
            placeholder="Depósito na plataforma"
          />
        </>
      )}
    </Formulario>
  );
}

// ------------------------------------------------------------------ cotação

export function DefinirCotacao({ symbol }: { symbol?: string }) {
  const { acoes, hoje } = useDados();

  return (
    <Formulario
      titulo={symbol ? `Atualizar cotação de ${symbol}` : "Nova cotação"}
      descricao="Informe quanto o token vale hoje. Toda posição nesse token passa a ser avaliada por este preço."
      gatilho={
        symbol ? (
          <Button variant="ghost" size="sm" className="h-8">
            Atualizar
          </Button>
        ) : (
          <BotaoNovo>Nova cotação</BotaoNovo>
        )
      }
      aoEnviar={(dados) => {
        const resultado = cotacaoSchema.safeParse({
          symbol: symbol ?? texto(dados, "symbol"),
          priceUsd: texto(dados, "priceUsd"),
          updatedAt: texto(dados, "updatedAt"),
        });
        if (!resultado.success) return erros(resultado);
        return acoes.definirCotacao(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <div className="grid gap-4 sm:grid-cols-3">
          {symbol ? null : (
            <CampoTexto
              label="Token"
              name="symbol"
              obrigatorio
              erro={e.symbol}
              placeholder="SOL"
              autoFocus
            />
          )}
          <CampoTexto
            label="Preço em dólar"
            name="priceUsd"
            obrigatorio
            erro={e.priceUsd}
            placeholder="195.00"
            inputMode="decimal"
            autoFocus={Boolean(symbol)}
          />
          <CampoTexto
            label="Data"
            name="updatedAt"
            type="date"
            obrigatorio
            defaultValue={hoje}
            erro={e.updatedAt}
          />
        </div>
      )}
    </Formulario>
  );
}

// ------------------------------------------------------------------- vínculo

export function VincularConta({ projectId }: { projectId?: string }) {
  const { acoes, hoje } = useDados();
  const { projetos, contas } = useOpcoes();

  return (
    <Formulario
      titulo="Vincular conta ao projeto"
      descricao="Define que esta conta está farmando este projeto."
      gatilho={
        <Button size="sm" variant="outline">
          Vincular conta
        </Button>
      }
      aoEnviar={(dados) => {
        const resultado = vinculoSchema.safeParse({
          projectId: texto(dados, "projectId"),
          accountId: texto(dados, "accountId"),
          status: texto(dados, "status"),
          startedAt: texto(dados, "startedAt"),
        });
        if (!resultado.success) return erros(resultado);
        return acoes.vincularConta(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Projeto"
              name="projectId"
              obrigatorio
              defaultValue={projectId}
              erro={e.projectId}
              opcoes={projetos}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              obrigatorio
              erro={e.accountId}
              opcoes={contas}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Situação"
              name="status"
              defaultValue="ativa"
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
              defaultValue={hoje}
              erro={e.startedAt}
            />
          </div>
        </>
      )}
    </Formulario>
  );
}

// -------------------------------------------------------------------- tarefa

export function NovaTarefa({ projectId }: { projectId?: string }) {
  const { acoes, hoje } = useDados();
  const { projetos, contas } = useOpcoes();

  return (
    <Formulario
      titulo="Nova tarefa"
      descricao="Recorrente (check-in diário) ou com prazo fixo (quest que encerra)."
      gatilho={<BotaoNovo>Nova tarefa</BotaoNovo>}
      aoEnviar={(dados) => {
        const conta = texto(dados, "accountId");
        const recorrencia = texto(dados, "recurrence");
        const resultado = tarefaSchema.safeParse({
          projectId: texto(dados, "projectId"),
          accountId: nulo(conta),
          title: texto(dados, "title"),
          description: texto(dados, "description"),
          recurrence: recorrencia,
          intervalDays: nulo(texto(dados, "intervalDays")),
          dueDate: texto(dados, "dueDate"),
        });
        if (!resultado.success) return erros(resultado);
        if (resultado.data.recurrence === "none" && !resultado.data.dueDate) {
          return { dueDate: "Tarefa de prazo fixo precisa de uma data." };
        }
        acoes.criarTarefa(resultado.data);
        return null;
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Tarefa"
            name="title"
            obrigatorio
            erro={e.title}
            placeholder="Executar 3 trades"
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Projeto"
              name="projectId"
              obrigatorio
              defaultValue={projectId}
              erro={e.projectId}
              opcoes={projetos}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              erro={e.accountId}
              ajuda="Em branco = vale para todas as contas do projeto."
              opcoes={[{ valor: "", rotulo: "Todas as contas" }, ...contas]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelecao
              label="Repetição"
              name="recurrence"
              defaultValue="daily"
              erro={e.recurrence}
              className="sm:col-span-1"
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
              erro={e.intervalDays}
              ajuda="Só para 'a cada N dias'."
            />
            <CampoTexto
              label="Vencimento"
              name="dueDate"
              type="date"
              defaultValue={hoje}
              erro={e.dueDate}
            />
          </div>
          <CampoArea
            label="Descrição"
            name="description"
            erro={e.description}
            placeholder="Volume conta para o critério de elegibilidade."
          />
        </>
      )}
    </Formulario>
  );
}

// ---------------------------------------------------------------------- meta

export function NovaMeta({ projectId }: { projectId?: string }) {
  const { acoes } = useDados();
  const { projetos, contas } = useOpcoes();

  return (
    <Formulario
      titulo="Nova meta"
      descricao="Alvo de volume, saldo ou atividade para este projeto."
      gatilho={
        <Button size="sm" variant="outline">
          Nova meta
        </Button>
      }
      aoEnviar={(dados) => {
        const resultado = metaSchema.safeParse({
          projectId: texto(dados, "projectId"),
          accountId: nulo(texto(dados, "accountId")),
          title: texto(dados, "title"),
          metric: texto(dados, "metric"),
          target: texto(dados, "target"),
          deadline: texto(dados, "deadline"),
        });
        if (!resultado.success) return erros(resultado);
        return acoes.criarMeta(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoTexto
            label="Meta"
            name="title"
            obrigatorio
            erro={e.title}
            placeholder="Volume acumulado no perp"
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Projeto"
              name="projectId"
              obrigatorio
              defaultValue={projectId}
              erro={e.projectId}
              opcoes={projetos}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              erro={e.accountId}
              opcoes={[{ valor: "", rotulo: "Todas as contas" }, ...contas]}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelecao
              label="Métrica"
              name="metric"
              defaultValue="volume_usd"
              erro={e.metric}
              opcoes={[
                { valor: "volume_usd", rotulo: "Volume (USD)" },
                { valor: "balance_usd", rotulo: "Saldo (USD)" },
                { valor: "tx_count", rotulo: "Nº de transações" },
                { valor: "days_active", rotulo: "Dias ativos" },
              ]}
            />
            <CampoTexto
              label="Alvo"
              name="target"
              obrigatorio
              erro={e.target}
              placeholder="10000"
              inputMode="decimal"
            />
            <CampoTexto label="Prazo" name="deadline" type="date" erro={e.deadline} />
          </div>
        </>
      )}
    </Formulario>
  );
}

// -------------------------------------------------------------- recebimento

export function RegistrarRecebimento({ projectId }: { projectId?: string }) {
  const { acoes, hoje } = useDados();
  const { projetos, contas } = useOpcoes();

  return (
    <Formulario
      titulo="Registrar airdrop recebido"
      descricao="Quanto cada conta recebeu e a que preço. É o que fecha o ROI real."
      gatilho={<BotaoNovo>Registrar recebimento</BotaoNovo>}
      aoEnviar={(dados) => {
        const resultado = recebimentoSchema.safeParse({
          projectId: texto(dados, "projectId"),
          accountId: texto(dados, "accountId"),
          receivedAt: texto(dados, "receivedAt"),
          tokenSymbol: texto(dados, "tokenSymbol"),
          tokenAmount: texto(dados, "tokenAmount"),
          priceUsd: texto(dados, "priceUsd"),
        });
        if (!resultado.success) return erros(resultado);
        return acoes.registrarRecebimento(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Projeto"
              name="projectId"
              obrigatorio
              defaultValue={projectId}
              erro={e.projectId}
              opcoes={projetos}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              obrigatorio
              erro={e.accountId}
              opcoes={contas}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto
              label="Token"
              name="tokenSymbol"
              obrigatorio
              erro={e.tokenSymbol}
              placeholder="VTX"
            />
            <CampoTexto
              label="Quantidade"
              name="tokenAmount"
              obrigatorio
              erro={e.tokenAmount}
              placeholder="1250"
              inputMode="decimal"
            />
            <CampoTexto
              label="Preço (USD)"
              name="priceUsd"
              obrigatorio
              erro={e.priceUsd}
              placeholder="0.42"
              inputMode="decimal"
            />
          </div>
          <CampoTexto
            label="Data"
            name="receivedAt"
            type="date"
            obrigatorio
            defaultValue={hoje}
            erro={e.receivedAt}
          />
        </>
      )}
    </Formulario>
  );
}

// -------------------------------------------------------------------- pontos

export function RegistrarPontos({ projectId }: { projectId?: string }) {
  const { dataset, acoes, hoje } = useDados();
  const { contas } = useOpcoes();

  // Só projetos que declararam ter programa de pontos.
  const comPrograma = dataset.projects
    .filter((p) => p.pointsLabel !== null)
    .map((p) => ({ valor: p.id, rotulo: `${p.name} — ${p.pointsLabel}` }));

  if (comPrograma.length === 0) return null;

  return (
    <Formulario
      titulo="Registrar pontos"
      descricao="O total acumulado que a plataforma mostra hoje. O ganho do período sai da diferença entre dois registros."
      gatilho={<BotaoNovo>Registrar pontos</BotaoNovo>}
      aoEnviar={(dados) => {
        const resultado = pontosSchema.safeParse({
          projectId: texto(dados, "projectId"),
          accountId: texto(dados, "accountId"),
          takenAt: texto(dados, "takenAt"),
          points: texto(dados, "points"),
          note: texto(dados, "note"),
        });
        if (!resultado.success) return erros(resultado);
        return acoes.registrarPontos(resultado.data);
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Projeto"
              name="projectId"
              obrigatorio
              defaultValue={projectId}
              erro={e.projectId}
              opcoes={comPrograma}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              obrigatorio
              erro={e.accountId}
              opcoes={contas}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Total acumulado"
              name="points"
              obrigatorio
              erro={e.points}
              ajuda="O número que a plataforma exibe, não o ganho."
              placeholder="12.450"
              inputMode="decimal"
            />
            <CampoTexto
              label="Data"
              name="takenAt"
              type="date"
              obrigatorio
              defaultValue={hoje}
              erro={e.takenAt}
            />
          </div>
          <CampoTexto
            label="Observação"
            name="note"
            erro={e.note}
            placeholder="Semana de volume alto, bônus de maker…"
          />
        </>
      )}
    </Formulario>
  );
}
