"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";

import { CampoValorToken } from "@/components/forms/campo-valor-token";
import { CampoArea, CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { CampoData } from "@/components/forms/campo-data";
import { CampoValor } from "@/components/forms/campo-valor";
import { useDados } from "@/components/data-provider";
import { cents, formatUsd, fromDbNumeric, parseUserInput } from "@/lib/money";
import {
  direcaoDoTipo,
  efeitoDoTipo,
  rotuloDoTipo,
  TIPOS_LANCAMENTO,
} from "@/lib/finance";
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
  contaSchema,
  erros,
  lancamentoSchema,
  metaSchema,
  pontosSchema,
  progressoMetaSchema,
  volumeSchema,
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
  const { salvando } = useDados();
  const [aberto, setAberto] = useState(false);
  const [problemas, setProblemas] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  /*
   * Gravou, e agora espera a tela receber o dado antes de fechar. Ver o mesmo
   * trecho em `forms/editar`: fechar assim que o banco responde deixava um vão
   * em que o diálogo sumia e a lista ainda estava sem o registro novo.
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
              setAguardandoTela(true);
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
        return acoes.criarProjeto(bruto);
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
              defaultValue="2"
              erro={e.priority}
              opcoes={[
                { valor: "1", rotulo: "1 · Baixa" },
                { valor: "2", rotulo: "2 · Média" },
                { valor: "3", rotulo: "3 · Alta" },
              ]}
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
            <CampoData
              label="TGE previsto"
              name="expectedTgeDate"
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
        const bruto = {
          label: texto(dados, "label"),
          walletAddress: texto(dados, "walletAddress"),
          email: texto(dados, "email"),
        };
        const resultado = contaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.criarConta(bruto);
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
    /**
     * Todas as contas, sem filtrar por projeto.
     *
     * Só `VincularConta` usa: é o formulário que **cria** o vínculo, e oferecer
     * apenas as já vinculadas ali tornaria impossível vincular a primeira.
     *
     * Todo formulário que registra algo **dentro** de um projeto usa
     * `useContasDoProjeto`, que respeita o vínculo.
     */
    contas: dataset.accounts.map((a) => ({ valor: a.id, rotulo: a.label })),
  };
}

/**
 * Contas oferecidas para um projeto: as vinculadas a ele, ou todas enquanto
 * não houver vínculo nenhum. Ver `contasDisponiveisNoProjeto`.
 */
function useContasDoProjeto(projectId: string) {
  const { dataset } = useDados();

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

// ---------------------------------------------------------------- lançamento

/**
 * Lançamento novo, opcionalmente já com o tipo escolhido.
 *
 * `tipo` existe por causa dos botões de seção. "Registrar volume", clicado na
 * área de volume, abria o formulário em "Depósito" e com o foco no projeto: a
 * pessoa tinha de trocar o tipo e descer até a quantia, sendo que as duas
 * respostas já estavam ditas no botão que ela apertou.
 *
 * Com o tipo definido, o título e a descrição também mudam. Um diálogo que diz
 * "Novo lançamento: depósito, retirada, resultado de trade ou volume" depois de
 * um clique em "Registrar volume" faz duvidar se o clique funcionou.
 */
export function NovoLancamento({
  projectId,
  tipo,
  rotulo = "Novo lançamento",
}: {
  projectId?: string;
  tipo?: string;
  rotulo?: string;
}) {
  const { acoes, hoje } = useDados();
  const { projetos } = useOpcoes();
  const [projetoSel, setProjetoSel] = useState(projectId ?? projetos[0]?.valor ?? "");
  const contas = useContasDoProjeto(projetoSel);

  /*
   * O sinal é decidido pelo tipo (ver aplicarSinalDoTipo), então o campo pede
   * só a quantia. Mostrar para onde o dinheiro vai evita a dúvida de digitar
   * ou não o menos, que antes produzia um saque somando à posição.
   */
  const [tipoSel, setTipoSel] = useState(tipo ?? "deposit");
  const direcao = direcaoDoTipo(tipoSel);

  return (
    <Formulario
      titulo={tipo ? (rotuloDoTipo(tipo) ?? "Novo lançamento") : "Novo lançamento"}
      descricao={
        tipo
          ? efeitoDoTipo(tipo)
          : "Depósito, retirada, resultado de trade ou volume operado."
      }
      gatilho={<BotaoNovo>{rotulo}</BotaoNovo>}
      aoEnviar={(dados) => {
        const bruto = {
          projectId: texto(dados, "projectId"),
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
        return acoes.criarLancamento(bruto);
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
              onChange={(evento) => setProjetoSel(evento.target.value)}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              obrigatorio
              erro={e.accountId}
              opcoes={contas}
              ajuda={
                contas.length === 1
                  ? "Única conta vinculada a este projeto."
                  : undefined
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao
              label="Tipo"
              name="type"
              defaultValue={tipo ?? "deposit"}
              erro={e.type}
              onChange={(evento) => setTipoSel(evento.target.value)}
              ajuda={
                direcao === "saida"
                  ? "Informe só a quantia: o sinal é aplicado. " +
                    efeitoDoTipo(tipoSel)
                  : direcao === "ambos"
                    ? "Use o sinal de menos para perda. " + efeitoDoTipo(tipoSel)
                    : efeitoDoTipo(tipoSel)
              }
              opcoes={[...TIPOS_LANCAMENTO]}
            />
            <CampoData
              label="Data"
              name="occurredAt"
              obrigatorio
              defaultValue={hoje}
              erro={e.occurredAt}
            />
          </div>
          <CampoValorToken erros={e} focar={Boolean(tipo)} />

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
  const [preco, setPreco] = useState("");

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
        const bruto = {
          symbol: symbol ?? texto(dados, "symbol"),
          priceUsd: texto(dados, "priceUsd"),
          updatedAt: texto(dados, "updatedAt"),
        };
        const resultado = cotacaoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.definirCotacao(bruto);
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
          <CampoValor
            label="Preço em dólar"
            name="priceUsd"
            obrigatorio
            valor={preco}
            aoMudar={setPreco}
            erro={e.priceUsd}
            placeholder="195.00"
            autoFocus={Boolean(symbol)}
          />
          <CampoData
            label="Data"
            name="updatedAt"
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
  // A lista completa aqui é proposital: ver o comentário em `useOpcoes`.
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
        const bruto = {
          projectId: texto(dados, "projectId"),
          accountId: texto(dados, "accountId"),
          status: texto(dados, "status"),
          startedAt: texto(dados, "startedAt"),
        };
        const resultado = vinculoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.vincularConta(bruto);
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
              autoFocus={Boolean(projectId)}
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
            <CampoData
              label="Início"
              name="startedAt"
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
  const { acoes, hoje, dataset } = useDados();
  const { projetos } = useOpcoes();

  /*
   * Deixar a conta em branco cria a tarefa para várias contas de uma vez. Isso
   * não é óbvio olhando o campo, então o aviso aparece só quando a escolha for
   * essa, dizendo em quantas contas vai cair: um texto fixo de ajuda ficava
   * visível o tempo todo e mesmo assim passava despercebido.
   */
  const [projetoSel, setProjetoSel] = useState(projectId ?? projetos[0]?.valor ?? "");
  const [contaSel, setContaSel] = useState("");
  const [repeticao, setRepeticao] = useState("daily");
  const contas = useContasDoProjeto(projetoSel);

  // Espelha a regra do servidor: vínculos do projeto ou, na falta deles, todas
  // as contas. Ver `contasDoProjeto` em actions/index.ts.
  const vinculadas = dataset.projectAccounts.filter(
    (pa) => pa.projectId === projetoSel,
  ).length;
  const alcance = vinculadas > 0 ? vinculadas : dataset.accounts.length;

  return (
    <Formulario
      titulo="Nova tarefa"
      descricao="Recorrente (check-in diário) ou com prazo fixo (quest que encerra)."
      gatilho={<BotaoNovo>Nova tarefa</BotaoNovo>}
      aoEnviar={(dados) => {
        const conta = texto(dados, "accountId");
        const recorrencia = texto(dados, "recurrence");
        const bruto = {
          projectId: texto(dados, "projectId"),
          accountId: nulo(conta),
          title: texto(dados, "title"),
          description: texto(dados, "description"),
          recurrence: recorrencia,
          intervalDays: nulo(texto(dados, "intervalDays")),
          dueDate: texto(dados, "dueDate"),
        };
        const resultado = tarefaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        if (bruto.recurrence === "none" && !bruto.dueDate) {
          return { dueDate: "Tarefa de prazo fixo precisa de uma data." };
        }
        acoes.criarTarefa(bruto);
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
              onChange={(evento) => setProjetoSel(evento.target.value)}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              erro={e.accountId}
              opcoes={[{ valor: "", rotulo: "Todas as contas" }, ...contas]}
              onChange={(evento) => setContaSel(evento.target.value)}
            />
          </div>

          {contaSel === "" && alcance > 0 ? (
            <p
              role="status"
              className="border-border bg-secondary/50 text-muted-foreground rounded-md border px-3 py-2 text-sm"
            >
              Conta não selecionada: ao prosseguir, a tarefa será criada{" "}
              {alcance === 1 ? (
                <>na sua única conta.</>
              ) : (
                <>para todas as {alcance} contas.</>
              )}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelecao
              label="Repetição"
              name="recurrence"
              defaultValue="daily"
              erro={e.recurrence}
              className="sm:col-span-1"
              onChange={(evento) => setRepeticao(evento.target.value)}
              opcoes={[
                { valor: "none", rotulo: "Prazo fixo" },
                { valor: "daily", rotulo: "Diária" },
                { valor: "weekly", rotulo: "Semanal" },
                { valor: "monthly", rotulo: "Mensal" },
                { valor: "every_n_days", rotulo: "A cada N dias" },
              ]}
            />
            {/*
              O intervalo só existe para "a cada N dias": as outras repetições
              já dizem a frequência no próprio nome. Deixá-lo sempre visível
              punha na tela um campo que quase nunca se aplica, e a explicação
              de quando aplicar ocupava mais espaço que o campo.
            */}
            {repeticao === "every_n_days" ? (
              <CampoTexto
                label="A cada quantos dias?"
                name="intervalDays"
                type="number"
                min={1}
                obrigatorio
                erro={e.intervalDays}
                placeholder="3"
              />
            ) : null}
            <CampoData
              label="Vencimento"
              name="dueDate"
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
  const { projetos } = useOpcoes();
  const [alvo, setAlvo] = useState("");
  const [projetoSel, setProjetoSel] = useState(projectId ?? projetos[0]?.valor ?? "");
  const contas = useContasDoProjeto(projetoSel);

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
        const bruto = {
          projectId: texto(dados, "projectId"),
          accountId: nulo(texto(dados, "accountId")),
          title: texto(dados, "title"),
          metric: texto(dados, "metric"),
          target: texto(dados, "target"),
          deadline: texto(dados, "deadline"),
        };
        const resultado = metaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.criarMeta(bruto);
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
              onChange={(evento) => setProjetoSel(evento.target.value)}
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
            <CampoValor
              label="Alvo"
              name="target"
              obrigatorio
              valor={alvo}
              aoMudar={setAlvo}
              erro={e.target}
              placeholder="10000"
            />
            <CampoData label="Prazo" name="deadline" erro={e.deadline} />
          </div>
        </>
      )}
    </Formulario>
  );
}

/**
 * Lançamento de progresso numa meta.
 *
 * O gatilho é discreto de propósito: fica dentro do cartão da meta, ao lado do
 * número, porque é ali que a pergunta nasce. Um botão no topo da seção
 * obrigaria a escolher a meta de novo numa lista, sendo que o clique já disse
 * qual era.
 *
 * O valor é **somado** ao que já existe, e não substitui. Volume acumula, e a
 * pergunta que a pessoa se faz é "quanto rodei agora", não "quanto tenho no
 * total": a segunda exigiria refazer a conta de cabeça a cada lançamento.
 */
export function LancarProgressoMeta({
  goalId,
  titulo,
}: {
  goalId: string;
  titulo: string;
}) {
  const { acoes, hoje } = useDados();
  const [valor, setValor] = useState("");

  return (
    <Formulario
      titulo="Lançar progresso"
      descricao={`Soma ao que já foi registrado em "${titulo}".`}
      gatilho={
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
          Lançar
        </Button>
      }
      aoEnviar={(dados) => {
        const bruto = {
          goalId,
          occurredAt: texto(dados, "occurredAt"),
          value: texto(dados, "value"),
          note: texto(dados, "note"),
        };
        const resultado = progressoMetaSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.lancarProgressoMeta(bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoValor
              label="Quanto somar"
              name="value"
              obrigatorio
              autoFocus
              valor={valor}
              aoMudar={setValor}
              erro={e.value}
              ajuda="Use o sinal de menos para corrigir um lançamento a mais."
              placeholder="1500.00"
            />
            <CampoData
              label="Data"
              name="occurredAt"
              obrigatorio
              defaultValue={hoje}
              erro={e.occurredAt}
            />
          </div>
          <CampoTexto
            label="Nota"
            name="note"
            erro={e.note}
            placeholder="Semana de volume alto no perp"
          />
        </>
      )}
    </Formulario>
  );
}

// -------------------------------------------------------------- recebimento

/**
 * Registro de airdrop recebido, em duas formas de dizer a mesma coisa.
 *
 * Quem sabe quanto recebeu e a que preço informa os dois, e o valor sai da
 * multiplicação. Quem só sabe que "deu uns $75" informa o total direto: é o
 * caso comum de token já vendido, ou de número que veio de um resumo da
 * corretora. Exigir a decomposição obrigaria a inventar quantidade ou preço.
 *
 * A escolha fica antes dos campos, e não depois, porque ela decide **quais
 * campos aparecem**: mostrada no fim, a pessoa preencheria para depois
 * descobrir que preencheu o formulário errado.
 */
export function RegistrarRecebimento({ projectId }: { projectId?: string }) {
  const { acoes, hoje } = useDados();
  const { projetos } = useOpcoes();
  const [projetoSel, setProjetoSel] = useState(projectId ?? projetos[0]?.valor ?? "");
  const contas = useContasDoProjeto(projetoSel);
  const [modo, setModo] = useState<"token" | "total">("token");
  const [quantidade, setQuantidade] = useState("");
  const [precoToken, setPrecoToken] = useState("");
  const [total, setTotal] = useState("");

  return (
    <Formulario
      titulo="Registrar airdrop recebido"
      descricao="Quanto cada conta recebeu. É o que fecha o ROI real."
      gatilho={<BotaoNovo>Registrar recebimento</BotaoNovo>}
      aoEnviar={(dados) => {
        const bruto = {
          projectId: texto(dados, "projectId"),
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
        return acoes.registrarRecebimento(bruto);
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
              onChange={(evento) => setProjetoSel(evento.target.value)}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              obrigatorio
              erro={e.accountId}
              opcoes={contas}
            />
          </div>
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
                autoFocus={Boolean(projectId)}
                erro={e.tokenSymbol}
                placeholder="VTX"
              />
              <CampoValor
                label="Quantidade"
                name="tokenAmount"
                obrigatorio
                valor={quantidade}
                aoMudar={setQuantidade}
                erro={e.tokenAmount}
                placeholder="1250"
                formato="quantidade"
              />
              <CampoValor
                label="Preço (USD)"
                name="priceUsd"
                obrigatorio
                valor={precoToken}
                aoMudar={setPrecoToken}
                erro={e.priceUsd}
                placeholder="0.42"
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* O token continua sendo pedido: saber que o airdrop foi em VTX
                  não depende de saber quanto era cada um, e é o que identifica
                  a linha na tabela depois. */}
              <CampoTexto
                label="Token"
                name="tokenSymbol"
                obrigatorio
                erro={e.tokenSymbol}
                placeholder="VTX"
              />
              <CampoValor
                label="Total recebido (USD)"
                name="valueUsd"
                obrigatorio
                valor={total}
                aoMudar={setTotal}
                erro={e.valueUsd}
                placeholder="525.00"
              />
            </div>
          )}
          <CampoData
            label="Data"
            name="receivedAt"
            obrigatorio
            defaultValue={hoje}
            erro={e.receivedAt}
          />
        </>
      )}
    </Formulario>
  );
}

/**
 * Medição de volume acumulado.
 *
 * O campo pede o **total** que a plataforma mostra, não o quanto rodou desde a
 * última vez. É a mesma escolha dos pontos, e pelo mesmo motivo: a corretora
 * exibe um acumulado, e pedir o incremento obrigaria a pessoa a fazer de cabeça
 * uma subtração que o sistema faz sozinho, com o agravante de que um incremento
 * esquecido some do total sem deixar rastro.
 *
 * A dica embaixo do campo mostra quanto isso representa desde a última medição,
 * antes de salvar: é onde se percebe um total digitado errado, porque um salto
 * absurdo aparece ali na hora.
 */
export function RegistrarVolume({ projectId }: { projectId?: string }) {
  const { dataset, acoes, hoje } = useDados();
  const { projetos } = useOpcoes();
  const [projetoSel, setProjetoSel] = useState(projectId ?? projetos[0]?.valor ?? "");
  const contas = useContasDoProjeto(projetoSel);
  const [contaSel, setContaSel] = useState("");
  const [valor, setValor] = useState("");

  const alvo = contaSel || contas[0]?.valor || "";
  const anterior = dataset.volumeSnapshots
    .filter((v) => v.projectId === projetoSel && v.accountId === alvo)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .at(-1);

  const digitado = parseUserInput(valor);
  const diferenca =
    anterior && digitado.ok
      ? digitado.value - fromDbNumeric(anterior.volumeUsd)
      : null;

  return (
    <Formulario
      titulo="Registrar volume acumulado"
      descricao="O total que a plataforma mostra hoje. A diferença para a medição anterior é calculada aqui."
      gatilho={<BotaoNovo>Registrar volume</BotaoNovo>}
      aoEnviar={(dados) => {
        const bruto = {
          projectId: texto(dados, "projectId"),
          accountId: texto(dados, "accountId"),
          takenAt: texto(dados, "takenAt"),
          volume: texto(dados, "volume"),
          note: texto(dados, "note"),
        };
        const resultado = volumeSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.registrarVolume(bruto);
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
              onChange={(evento) => setProjetoSel(evento.target.value)}
            />
            <CampoSelecao
              label="Conta"
              name="accountId"
              obrigatorio
              erro={e.accountId}
              opcoes={contas}
              onChange={(evento) => setContaSel(evento.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoValor
              label="Volume acumulado"
              name="volume"
              obrigatorio
              autoFocus={Boolean(projectId)}
              valor={valor}
              aoMudar={setValor}
              erro={e.volume}
              ajuda={
                anterior
                  ? `A última medição desta conta marcava ${formatUsd(fromDbNumeric(anterior.volumeUsd))}.`
                  : "Primeira medição desta conta: não há base de comparação ainda."
              }
              placeholder="125000.00"
            />
            <CampoData
              label="Data"
              name="takenAt"
              obrigatorio
              defaultValue={hoje}
              erro={e.takenAt}
            />
          </div>

          {diferenca !== null ? (
            <p
              className="border-border bg-secondary/40 rounded-md border px-3 py-2 text-xs"
              aria-live="polite"
            >
              {diferenca >= 0 ? (
                <>
                  Rodou{" "}
                  <strong className="text-positive">
                    {formatUsd(cents(diferenca))}
                  </strong>{" "}
                  desde a medição anterior.
                </>
              ) : (
                <span className="text-caution">
                  Esse total é menor que o da medição anterior. Volume acumulado
                  não diminui: confira se digitou o total, e não o do período.
                </span>
              )}
            </p>
          ) : null}

          <CampoTexto
            label="Nota"
            name="note"
            erro={e.note}
            placeholder="Semana de volume alto no perp"
          />
        </>
      )}
    </Formulario>
  );
}

// -------------------------------------------------------------------- pontos

export function RegistrarPontos({ projectId }: { projectId?: string }) {
  const { dataset, acoes, hoje } = useDados();

  // Só projetos que declararam ter programa de pontos.
  const comPrograma = dataset.projects
    .filter((p) => p.pointsLabel !== null)
    .map((p) => ({ valor: p.id, rotulo: `${p.name} · ${p.pointsLabel}` }));

  const [projetoSel, setProjetoSel] = useState(
    projectId ?? comPrograma[0]?.valor ?? "",
  );
  const contas = useContasDoProjeto(projetoSel);
  const [pontos, setPontos] = useState("");

  if (comPrograma.length === 0) return null;

  return (
    <Formulario
      titulo="Registrar pontos"
      descricao="O total acumulado que a plataforma mostra hoje. O ganho do período sai da diferença entre dois registros."
      gatilho={<BotaoNovo>Registrar pontos</BotaoNovo>}
      aoEnviar={(dados) => {
        const bruto = {
          projectId: texto(dados, "projectId"),
          accountId: texto(dados, "accountId"),
          takenAt: texto(dados, "takenAt"),
          points: texto(dados, "points"),
          note: texto(dados, "note"),
        };
        const resultado = pontosSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.registrarPontos(bruto);
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
              onChange={(evento) => setProjetoSel(evento.target.value)}
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
            <CampoValor
              autoFocus={Boolean(projectId)}
              label="Total acumulado"
              name="points"
              obrigatorio
              valor={pontos}
              aoMudar={setPontos}
              erro={e.points}
              ajuda="O número que a plataforma exibe, não o ganho."
              placeholder="12.450"
              formato="pontos"
            />
            <CampoData
              label="Data"
              name="takenAt"
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
