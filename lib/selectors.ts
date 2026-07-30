import type { Dataset } from "./dataset";
import { daysBetween, urgencyOf } from "./dates";
import {
  exposureForPair,
  latestSnapshotByPair,
  netFlowByPair,
  pairKey,
  sumOfType,
  summarizeFinancials,
  type PairExposure,
} from "./finance";
import { addCents, cents, fromDbNumeric, percentOf, subtractCents, ZERO, type Cents } from "./money";
import type {
  AccountSummary,
  AirdropClaimRow,
  AtividadeRow,
  CapitalPorProjeto,
  DashboardSummary,
  GoalRow,
  ProjectAccountRow,
  ProjectDetail,
  ProjectSummary,
  TaskOccurrenceRow,
  TipoAtividade,
  TransactionRow,
} from "./types";

/**
 * Agregação do domínio. Toda função é pura: `(Dataset, hoje) -> view model`.
 *
 * Nenhuma delas sabe se o Dataset veio do localStorage ou do Postgres, o que
 * é justamente o ponto — a mesma regra de negócio roda nos dois modos.
 */

// ------------------------------------------------------------------- helpers

function contexto(ds: Dataset) {
  return {
    snaps: latestSnapshotByPair(ds.balanceSnapshots),
    net: netFlowByPair(ds.transactions),
  };
}

function exposicaoDoPar(
  ds: Dataset,
  projectId: string,
  accountId: string,
): PairExposure {
  const { snaps, net } = contexto(ds);
  return exposureForPair(pairKey(projectId, accountId), snaps, net);
}

function exposicaoAgrupada(ds: Dataset, por: "project" | "account"): Map<string, Cents> {
  const { snaps, net } = contexto(ds);
  const result = new Map<string, Cents>();
  for (const par of ds.projectAccounts) {
    const exposure = exposureForPair(pairKey(par.projectId, par.accountId), snaps, net);
    const chave = por === "project" ? par.projectId : par.accountId;
    result.set(chave, addCents(result.get(chave) ?? ZERO, exposure.value));
  }
  return result;
}

const labelDaConta = (ds: Dataset, accountId: string) =>
  ds.accounts.find((a) => a.id === accountId)?.label ?? "conta removida";

function ultimaAtividade(
  ds: Dataset,
  filtro: (row: { projectId: string; accountId: string }) => boolean,
): string | null {
  const datas = [
    ...ds.transactions.filter(filtro).map((t) => t.occurredAt),
    ...ds.balanceSnapshots.filter(filtro).map((s) => s.takenAt),
  ];
  if (datas.length === 0) return null;
  return datas.reduce((maior, atual) => (atual > maior ? atual : maior));
}

function ocorrenciasPendentes(ds: Dataset) {
  const ativas = new Set(ds.tasks.filter((t) => t.isActive).map((t) => t.id));
  return ds.taskOccurrences.filter(
    (o) => ativas.has(o.taskId) && !o.completedAt && !o.skipped,
  );
}

// ----------------------------------------------------------------- dashboard

export function selectDashboardSummary(ds: Dataset, hoje: string): DashboardSummary {
  const financeiro = summarizeFinancials({
    movements: ds.transactions,
    snapshots: ds.balanceSnapshots,
    pairs: ds.projectAccounts,
    airdropsUsd: ds.airdropClaims.map((c) => c.valueUsd),
  });

  const pendentes = ocorrenciasPendentes(ds);

  return {
    ...financeiro,
    projetosAtivos: ds.projects.filter((p) => p.status === "ativo").length,
    projetosTotal: ds.projects.length,
    contasAtivas: new Set(
      ds.projectAccounts.filter((p) => p.status === "ativa").map((p) => p.accountId),
    ).size,
    tarefasHoje: pendentes.filter((o) => urgencyOf(o.dueDate, hoje) === "hoje").length,
    tarefasAtrasadas: pendentes.filter((o) => urgencyOf(o.dueDate, hoje) === "atrasada")
      .length,
  };
}

export function selectCapitalPorProjeto(ds: Dataset): CapitalPorProjeto[] {
  const exposicoes = exposicaoAgrupada(ds, "project");

  return ds.projects
    .map((projeto) => ({
      slug: projeto.slug,
      nome: projeto.name,
      aportado: sumOfType(
        ds.transactions.filter((t) => t.projectId === projeto.id),
        "deposit",
      ),
      exposicao: exposicoes.get(projeto.id) ?? ZERO,
    }))
    .filter((p) => p.aportado > 0 || p.exposicao > 0)
    .sort((a, b) => b.aportado - a.aportado);
}

// ------------------------------------------------------------------ projetos

export function selectProjects(ds: Dataset, hoje: string): ProjectSummary[] {
  const exposicoes = exposicaoAgrupada(ds, "project");
  const pendentes = ocorrenciasPendentes(ds);

  return ds.projects
    .map((projeto) => {
      const idsTarefas = new Set(
        ds.tasks.filter((t) => t.projectId === projeto.id).map((t) => t.id),
      );
      const doProjeto = pendentes.filter((o) => idsTarefas.has(o.taskId));
      const aportado = sumOfType(
        ds.transactions.filter((t) => t.projectId === projeto.id),
        "deposit",
      );
      const exposicao = exposicoes.get(projeto.id) ?? ZERO;
      const resultado = subtractCents(exposicao, aportado);

      return {
        id: projeto.id,
        slug: projeto.slug,
        nome: projeto.name,
        status: projeto.status,
        categoria: projeto.category,
        chain: projeto.chain,
        prioridade: projeto.priority,
        aportado,
        exposicao,
        resultado,
        roi: percentOf(resultado, aportado),
        contas: ds.projectAccounts.filter((p) => p.projectId === projeto.id).length,
        tarefasPendentes: doProjeto.length,
        tarefasAtrasadas: doProjeto.filter(
          (o) => urgencyOf(o.dueDate, hoje) === "atrasada",
        ).length,
        ultimaAtividade: ultimaAtividade(ds, (r) => r.projectId === projeto.id),
        tgePrevisto: projeto.expectedTgeDate,
      } satisfies ProjectSummary;
    })
    .sort((a, b) => b.prioridade - a.prioridade || b.aportado - a.aportado);
}

export function selectProjectBySlug(
  ds: Dataset,
  slug: string,
  hoje: string,
): ProjectDetail | null {
  const projeto = ds.projects.find((p) => p.slug === slug);
  if (!projeto) return null;

  const pares = ds.projectAccounts.filter((p) => p.projectId === projeto.id);
  const movimentos = ds.transactions.filter((t) => t.projectId === projeto.id);
  const snaps = ds.balanceSnapshots.filter((s) => s.projectId === projeto.id);
  const claims = ds.airdropClaims.filter((c) => c.projectId === projeto.id);

  const financeiro = summarizeFinancials({
    movements: movimentos,
    snapshots: snaps,
    pairs: pares,
    airdropsUsd: claims.map((c) => c.valueUsd),
  });

  const idsTarefas = new Set(
    ds.tasks.filter((t) => t.projectId === projeto.id).map((t) => t.id),
  );
  const pendentes = ocorrenciasPendentes(ds).filter((o) => idsTarefas.has(o.taskId));

  const contasDetalhe: ProjectAccountRow[] = pares
    .map((par) => {
      const doPar = movimentos.filter((t) => t.accountId === par.accountId);
      const aportado = sumOfType(doPar, "deposit");
      const exposure = exposicaoDoPar(ds, projeto.id, par.accountId);

      return {
        contaId: par.accountId,
        label: labelDaConta(ds, par.accountId),
        status: par.status,
        aportado,
        saldo: exposure.confirmed ? exposure.value : null,
        saldoEm: exposure.takenAt,
        resultado: exposure.confirmed ? subtractCents(exposure.value, aportado) : null,
        tarefasPendentes: pendentes.filter((o) => o.accountId === par.accountId).length,
        ultimaAtividade: ultimaAtividade(
          ds,
          (r) => r.projectId === projeto.id && r.accountId === par.accountId,
        ),
      } satisfies ProjectAccountRow;
    })
    .sort((a, b) => b.aportado - a.aportado);

  const historico: TransactionRow[] = [
    ...movimentos.map((t) => ({
      id: t.id,
      data: t.occurredAt,
      projetoSlug: projeto.slug,
      projetoNome: projeto.name,
      contaLabel: labelDaConta(ds, t.accountId),
      tipo: t.type,
      valor: fromDbNumeric(t.amountUsd),
      descricao: t.description,
    })),
    ...snaps.map((s) => ({
      id: s.id,
      data: s.takenAt,
      projetoSlug: projeto.slug,
      projetoNome: projeto.name,
      contaLabel: labelDaConta(ds, s.accountId),
      tipo: "other" as const,
      valor: fromDbNumeric(s.balanceUsd),
      descricao: "Saldo atualizado",
      isSnapshot: true,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const metas: GoalRow[] = ds.goals
    .filter((g) => g.projectId === projeto.id)
    .map((g) => {
      const relevantes = movimentos.filter(
        (t) => g.accountId === null || t.accountId === g.accountId,
      );
      // Fonte de cada métrica: ARCHITECTURE.md §4.3-C.
      let atual: Cents;
      if (g.metric === "volume_usd") {
        atual = sumOfType(relevantes, "volume_traded");
      } else if (g.metric === "balance_usd") {
        atual = g.accountId
          ? exposicaoDoPar(ds, projeto.id, g.accountId).value
          : financeiro.exposicao;
      } else if (g.metric === "tx_count") {
        atual = cents(relevantes.length);
      } else {
        atual = cents(new Set(relevantes.map((t) => t.occurredAt)).size);
      }

      return {
        id: g.id,
        titulo: g.title,
        metrica: g.metric,
        alvo: fromDbNumeric(g.targetValue),
        atual,
        contaLabel: g.accountId ? labelDaConta(ds, g.accountId) : null,
        prazo: g.deadline,
        concluidaEm: g.achievedAt,
      } satisfies GoalRow;
    });

  const recebimentos: AirdropClaimRow[] = claims.map((c) => ({
    id: c.id,
    contaLabel: labelDaConta(ds, c.accountId),
    recebidoEm: c.receivedAt,
    token: c.tokenSymbol,
    quantidade: c.tokenAmount,
    precoUsd: c.priceUsd,
    valor: fromDbNumeric(c.valueUsd),
  }));

  return {
    id: projeto.id,
    slug: projeto.slug,
    nome: projeto.name,
    status: projeto.status,
    categoria: projeto.category,
    chain: projeto.chain,
    prioridade: projeto.priority,
    aportado: financeiro.aportado,
    exposicao: financeiro.exposicao,
    resultado: financeiro.resultado,
    roi: financeiro.roi,
    contas: pares.length,
    tarefasPendentes: pendentes.length,
    tarefasAtrasadas: pendentes.filter((o) => urgencyOf(o.dueDate, hoje) === "atrasada")
      .length,
    ultimaAtividade: ultimaAtividade(ds, (r) => r.projectId === projeto.id),
    tgePrevisto: projeto.expectedTgeDate,
    links: {
      website: projeto.websiteUrl,
      discord: projeto.discordUrl,
      twitter: projeto.twitterUrl,
      docs: projeto.docsUrl,
    },
    notas: projeto.notes,
    contasDetalhe,
    historico,
    metas,
    recebimentos,
  };
}

// ------------------------------------------------------------------- tarefas

function montarTarefa(
  ds: Dataset,
  occ: Dataset["taskOccurrences"][number],
  hoje: string,
): TaskOccurrenceRow | null {
  const tarefa = ds.tasks.find((t) => t.id === occ.taskId);
  if (!tarefa || !tarefa.isActive) return null;
  const projeto = ds.projects.find((p) => p.id === tarefa.projectId);
  if (!projeto) return null;

  return {
    id: occ.id,
    taskId: tarefa.id,
    titulo: tarefa.title,
    descricao: tarefa.description,
    projetoSlug: projeto.slug,
    projetoNome: projeto.name,
    contaLabel: labelDaConta(ds, occ.accountId),
    vencimento: occ.dueDate,
    recorrencia: tarefa.recurrence,
    concluida: occ.completedAt !== null,
    urgencia: urgencyOf(occ.dueDate, hoje),
    diasRestantes: daysBetween(hoje, occ.dueDate),
  };
}

export function selectPendingTasks(ds: Dataset, hoje: string): TaskOccurrenceRow[] {
  return ocorrenciasPendentes(ds)
    .map((o) => montarTarefa(ds, o, hoje))
    .filter((r): r is TaskOccurrenceRow => r !== null)
    .sort(
      (a, b) =>
        a.vencimento.localeCompare(b.vencimento) ||
        a.projetoNome.localeCompare(b.projetoNome) ||
        a.contaLabel.localeCompare(b.contaLabel),
    );
}

export function selectCompletedToday(ds: Dataset, hoje: string): TaskOccurrenceRow[] {
  return ds.taskOccurrences
    .filter((o) => o.completedAt !== null && o.dueDate === hoje)
    .map((o) => montarTarefa(ds, o, hoje))
    .filter((r): r is TaskOccurrenceRow => r !== null);
}

export function selectTasksByProject(
  ds: Dataset,
  projectId: string,
  hoje: string,
): TaskOccurrenceRow[] {
  const ids = new Set(ds.tasks.filter((t) => t.projectId === projectId).map((t) => t.id));
  return ocorrenciasPendentes(ds)
    .filter((o) => ids.has(o.taskId))
    .map((o) => montarTarefa(ds, o, hoje))
    .filter((r): r is TaskOccurrenceRow => r !== null)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

// -------------------------------------------------------------------- contas

export function selectAccounts(ds: Dataset): AccountSummary[] {
  const exposicoes = exposicaoAgrupada(ds, "account");
  const pendentes = ocorrenciasPendentes(ds);

  return ds.accounts
    .map((conta) => {
      const aportado = sumOfType(
        ds.transactions.filter((t) => t.accountId === conta.id),
        "deposit",
      );
      const exposicao = exposicoes.get(conta.id) ?? ZERO;

      return {
        id: conta.id,
        label: conta.label,
        endereco: conta.walletAddress,
        email: conta.email,
        ativa: conta.isActive,
        projetos: ds.projectAccounts.filter((p) => p.accountId === conta.id).length,
        aportado,
        exposicao,
        resultado: subtractCents(exposicao, aportado),
        tarefasPendentes: pendentes.filter((o) => o.accountId === conta.id).length,
        ultimaAtividade: ultimaAtividade(ds, (r) => r.accountId === conta.id),
      } satisfies AccountSummary;
    })
    .sort((a, b) => b.aportado - a.aportado);
}

// ------------------------------------------------------------- dependências

/**
 * O que uma exclusão leva junto.
 *
 * Serve para a confirmação dizer "isto apaga também 8 lançamentos e 2 tarefas"
 * em vez de um genérico "tem certeza?". Espelha exatamente o que as ações de
 * exclusão em cascata removem.
 */
export function contarDependenciasProjeto(ds: Dataset, projectId: string) {
  const tarefas = ds.tasks.filter((t) => t.projectId === projectId);
  const idsTarefas = new Set(tarefas.map((t) => t.id));
  return {
    contas: ds.projectAccounts.filter((p) => p.projectId === projectId).length,
    lancamentos: ds.transactions.filter((t) => t.projectId === projectId).length,
    saldos: ds.balanceSnapshots.filter((s) => s.projectId === projectId).length,
    tarefas: tarefas.length,
    ocorrencias: ds.taskOccurrences.filter((o) => idsTarefas.has(o.taskId)).length,
    metas: ds.goals.filter((g) => g.projectId === projectId).length,
    recebimentos: ds.airdropClaims.filter((c) => c.projectId === projectId).length,
  };
}

export function contarDependenciasConta(ds: Dataset, accountId: string) {
  return {
    projetos: ds.projectAccounts.filter((p) => p.accountId === accountId).length,
    lancamentos: ds.transactions.filter((t) => t.accountId === accountId).length,
    saldos: ds.balanceSnapshots.filter((s) => s.accountId === accountId).length,
    ocorrencias: ds.taskOccurrences.filter((o) => o.accountId === accountId).length,
    recebimentos: ds.airdropClaims.filter((c) => c.accountId === accountId).length,
  };
}

export function contarDependenciasVinculo(
  ds: Dataset,
  projectId: string,
  accountId: string,
) {
  return {
    lancamentos: ds.transactions.filter(
      (t) => t.projectId === projectId && t.accountId === accountId,
    ).length,
    saldos: ds.balanceSnapshots.filter(
      (s) => s.projectId === projectId && s.accountId === accountId,
    ).length,
  };
}

/** "3 lançamentos, 1 saldo e 2 tarefas" — some itens zerados. */
export function descreverImpacto(contagem: Record<string, number>): string | null {
  const rotulos: Record<string, [string, string]> = {
    contas: ["vínculo de conta", "vínculos de conta"],
    projetos: ["vínculo de projeto", "vínculos de projeto"],
    lancamentos: ["lançamento", "lançamentos"],
    saldos: ["saldo registrado", "saldos registrados"],
    tarefas: ["tarefa", "tarefas"],
    ocorrencias: ["ocorrência de tarefa", "ocorrências de tarefa"],
    metas: ["meta", "metas"],
    recebimentos: ["recebimento", "recebimentos"],
  };

  const partes = Object.entries(contagem)
    .filter(([, n]) => n > 0)
    .map(([chave, n]) => {
      const [singular, plural] = rotulos[chave] ?? [chave, chave];
      return `${n} ${n === 1 ? singular : plural}`;
    });

  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0]!;
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

// ------------------------------------------------------------------ histórico

const rotuloPorTipo: Record<string, { titulo: string; tipo: TipoAtividade }> = {
  deposit: { titulo: "Depósito", tipo: "deposito" },
  withdrawal: { titulo: "Retirada", tipo: "retirada" },
  trade_pnl: { titulo: "Resultado de trade", tipo: "trade" },
  fee_gas: { titulo: "Taxa / gas", tipo: "taxa" },
  volume_traded: { titulo: "Volume operado", tipo: "volume" },
  other: { titulo: "Lançamento", tipo: "deposito" },
};

/**
 * Histórico unificado: tudo que aconteceu, em ordem cronológica.
 *
 * Junta lançamentos, saldos registrados, airdrops recebidos e tarefas
 * concluídas num feed único. É derivado dos registros existentes, então
 * funciona retroativamente sobre dados já cadastrados — diferente de uma
 * tabela de auditoria, que só passa a valer a partir do dia em que existe.
 *
 * Por isso não mostra edições nem exclusões: o rastro de "quem mudou o quê"
 * exigiria gravar cada ação, o que é decisão da fase de backend.
 */
export function selectAtividade(ds: Dataset, limite?: number): AtividadeRow[] {
  const nomeProjeto = (id: string) => ds.projects.find((p) => p.id === id);

  const linhas: AtividadeRow[] = [];

  for (const t of ds.transactions) {
    const projeto = nomeProjeto(t.projectId);
    if (!projeto) continue;
    const rotulo = rotuloPorTipo[t.type] ?? rotuloPorTipo.other!;
    linhas.push({
      id: `tx-${t.id}`,
      tipo: rotulo.tipo,
      data: t.occurredAt,
      projetoSlug: projeto.slug,
      projetoNome: projeto.name,
      contaLabel: labelDaConta(ds, t.accountId),
      titulo: rotulo.titulo,
      detalhe: t.description,
      valor: fromDbNumeric(t.amountUsd),
    });
  }

  for (const s of ds.balanceSnapshots) {
    const projeto = nomeProjeto(s.projectId);
    if (!projeto) continue;
    linhas.push({
      id: `snp-${s.id}`,
      tipo: "saldo",
      data: s.takenAt,
      projetoSlug: projeto.slug,
      projetoNome: projeto.name,
      contaLabel: labelDaConta(ds, s.accountId),
      titulo: "Saldo atualizado",
      detalhe: null,
      valor: fromDbNumeric(s.balanceUsd),
    });
  }

  for (const c of ds.airdropClaims) {
    const projeto = nomeProjeto(c.projectId);
    if (!projeto) continue;
    linhas.push({
      id: `clm-${c.id}`,
      tipo: "recebimento",
      data: c.receivedAt,
      projetoSlug: projeto.slug,
      projetoNome: projeto.name,
      contaLabel: labelDaConta(ds, c.accountId),
      titulo: "Airdrop recebido",
      detalhe: `${c.tokenAmount} ${c.tokenSymbol}`,
      valor: fromDbNumeric(c.valueUsd),
    });
  }

  for (const o of ds.taskOccurrences) {
    if (!o.completedAt) continue;
    const tarefa = ds.tasks.find((t) => t.id === o.taskId);
    if (!tarefa) continue;
    const projeto = nomeProjeto(tarefa.projectId);
    if (!projeto) continue;
    linhas.push({
      id: `occ-${o.id}`,
      tipo: "tarefa",
      // A conclusão é um instante ISO; o feed trabalha em dias.
      data: o.completedAt.slice(0, 10),
      projetoSlug: projeto.slug,
      projetoNome: projeto.name,
      contaLabel: labelDaConta(ds, o.accountId),
      titulo: "Tarefa concluída",
      detalhe: tarefa.title,
      valor: null,
    });
  }

  const ordenado = linhas.sort(
    (a, b) => b.data.localeCompare(a.data) || a.projetoNome.localeCompare(b.projetoNome),
  );
  return limite ? ordenado.slice(0, limite) : ordenado;
}

/** Agrupa o feed por dia, para a interface renderizar com cabeçalho de data. */
export function agruparAtividadePorDia(linhas: AtividadeRow[]) {
  const mapa = new Map<string, AtividadeRow[]>();
  for (const linha of linhas) {
    const doDia = mapa.get(linha.data) ?? [];
    doDia.push(linha);
    mapa.set(linha.data, doDia);
  }
  return [...mapa.entries()].map(([data, itens]) => ({ data, itens }));
}
