"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { novoId, uniqueSlug, type Dataset } from "@/lib/dataset";
import { criarRelogio, DatasetStore } from "@/lib/local-store";
import { toDbNumeric, type Cents } from "@/lib/money";

/**
 * Estado local da aplicação — modo de teste, sem backend.
 *
 * O Dataset inicial vem do servidor (fixtures) e tudo que você cadastra fica
 * em localStorage. É deliberadamente temporário: na fase de backend este
 * provider sai e as telas passam a receber os dados de Server Components,
 * chamando as MESMAS funções de `lib/selectors`.
 *
 * Hidratação: o estado vem de `useSyncExternalStore`, que entrega as fixtures
 * no servidor (`getServerSnapshot`) e o conteúdo do localStorage no cliente.
 * É o mecanismo que o React oferece para ler sistemas externos sem provocar
 * divergência de hidratação nem renderização em cascata.
 */

type Acoes = {
  criarProjeto: (dados: {
    name: string;
    status: Dataset["projects"][number]["status"];
    chain: string | null;
    priority: number;
    websiteUrl: string | null;
    discordUrl: string | null;
    twitterUrl: string | null;
    docsUrl: string | null;
    expectedTgeDate: string | null;
    notes: string | null;
  }) => string;
  criarConta: (dados: {
    label: string;
    walletAddress: string | null;
    email: string | null;
  }) => string;
  vincularConta: (dados: {
    projectId: string;
    accountId: string;
    status: "ativa" | "pausada" | "queimada";
    startedAt: string;
  }) => void;
  criarLancamento: (dados: {
    projectId: string;
    accountId: string;
    occurredAt: string;
    type: Dataset["transactions"][number]["type"];
    amount: Cents;
    description: string | null;
  }) => void;
  registrarSaldo: (dados: {
    projectId: string;
    accountId: string;
    takenAt: string;
    balance: Cents;
  }) => void;
  criarTarefa: (dados: {
    projectId: string;
    accountId: string | null;
    title: string;
    description: string | null;
    recurrence: Dataset["tasks"][number]["recurrence"];
    intervalDays: number | null;
    dueDate: string | null;
  }) => void;
  alternarTarefa: (occurrenceId: string) => void;
  criarMeta: (dados: {
    projectId: string;
    accountId: string | null;
    title: string;
    metric: Dataset["goals"][number]["metric"];
    target: Cents;
    deadline: string | null;
  }) => void;
  registrarRecebimento: (dados: {
    projectId: string;
    accountId: string;
    receivedAt: string;
    tokenSymbol: string;
    tokenAmount: string;
    priceUsd: string;
  }) => void;
  restaurarOriginal: () => void;
};

type Contexto = {
  dataset: Dataset;
  hoje: string;
  modificado: boolean;
  acoes: Acoes;
};

const DataContext = createContext<Contexto | null>(null);

export function DataProvider({
  initialDataset,
  initialToday,
  children,
}: {
  initialDataset: Dataset;
  initialToday: string;
  children: ReactNode;
}) {
  const [store] = useState(() => new DatasetStore(initialDataset));
  const [relogio] = useState(() => criarRelogio(initialToday));

  const dataset = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const hoje = useSyncExternalStore(
    relogio.subscribe,
    relogio.getSnapshot,
    relogio.getServerSnapshot,
  );
  const modificado = dataset !== initialDataset;

  const atualizar = useCallback(
    (fn: (atual: Dataset) => Dataset) => {
      store.atualizar(fn);
    },
    [store],
  );

  const acoes = useMemo<Acoes>(
    () => ({
      criarProjeto: (dados) => {
        const id = novoId("prj");
        atualizar((atual) => ({
          ...atual,
          projects: [
            ...atual.projects,
            {
              id,
              slug: uniqueSlug(
                dados.name,
                atual.projects.map((p) => p.slug),
              ),
              name: dados.name,
              status: dados.status,
              chain: dados.chain,
              priority: dados.priority,
              websiteUrl: dados.websiteUrl,
              discordUrl: dados.discordUrl,
              twitterUrl: dados.twitterUrl,
              docsUrl: dados.docsUrl,
              expectedTgeDate: dados.expectedTgeDate,
              notes: dados.notes,
            },
          ],
        }));
        return id;
      },

      criarConta: (dados) => {
        const id = novoId("acc");
        atualizar((atual) => ({
          ...atual,
          accounts: [
            ...atual.accounts,
            {
              id,
              label: dados.label,
              walletAddress: dados.walletAddress,
              email: dados.email,
              isActive: true,
            },
          ],
        }));
        return id;
      },

      vincularConta: (dados) => {
        atualizar((atual) => {
          const jaExiste = atual.projectAccounts.some(
            (p) => p.projectId === dados.projectId && p.accountId === dados.accountId,
          );
          if (jaExiste) return atual;
          return { ...atual, projectAccounts: [...atual.projectAccounts, dados] };
        });
      },

      criarLancamento: (dados) => {
        atualizar((atual) => ({
          ...atual,
          // Vincula a conta ao projeto se ainda não estiver: garante a mesma
          // integridade que a FK composta impõe no banco (ARCHITECTURE.md §4.3-B).
          projectAccounts: atual.projectAccounts.some(
            (p) => p.projectId === dados.projectId && p.accountId === dados.accountId,
          )
            ? atual.projectAccounts
            : [
                ...atual.projectAccounts,
                {
                  projectId: dados.projectId,
                  accountId: dados.accountId,
                  status: "ativa" as const,
                  startedAt: dados.occurredAt,
                },
              ],
          transactions: [
            ...atual.transactions,
            {
              id: novoId("tx"),
              projectId: dados.projectId,
              accountId: dados.accountId,
              occurredAt: dados.occurredAt,
              type: dados.type,
              amountUsd: toDbNumeric(dados.amount),
              description: dados.description,
            },
          ],
        }));
      },

      registrarSaldo: (dados) => {
        atualizar((atual) => ({
          ...atual,
          projectAccounts: atual.projectAccounts.some(
            (p) => p.projectId === dados.projectId && p.accountId === dados.accountId,
          )
            ? atual.projectAccounts
            : [
                ...atual.projectAccounts,
                {
                  projectId: dados.projectId,
                  accountId: dados.accountId,
                  status: "ativa" as const,
                  startedAt: dados.takenAt,
                },
              ],
          // Um snapshot por par por dia — mesma regra do unique no banco.
          balanceSnapshots: [
            ...atual.balanceSnapshots.filter(
              (s) =>
                !(
                  s.projectId === dados.projectId &&
                  s.accountId === dados.accountId &&
                  s.takenAt === dados.takenAt
                ),
            ),
            {
              id: novoId("snp"),
              projectId: dados.projectId,
              accountId: dados.accountId,
              takenAt: dados.takenAt,
              balanceUsd: toDbNumeric(dados.balance),
            },
          ],
        }));
      },

      criarTarefa: (dados) => {
        atualizar((atual) => {
          const taskId = novoId("tsk");
          // Conta nula = a tarefa vale para todas as contas do projeto.
          const contasAlvo = dados.accountId
            ? [dados.accountId]
            : atual.projectAccounts
                .filter((p) => p.projectId === dados.projectId)
                .map((p) => p.accountId);

          const vencimento =
            dados.dueDate ??
            new Date().toISOString().slice(0, 10);

          return {
            ...atual,
            tasks: [
              ...atual.tasks,
              {
                id: taskId,
                projectId: dados.projectId,
                accountId: dados.accountId,
                title: dados.title,
                description: dados.description,
                recurrence: dados.recurrence,
                intervalDays: dados.intervalDays,
                dueDate: dados.dueDate,
                isActive: true,
              },
            ],
            taskOccurrences: [
              ...atual.taskOccurrences,
              ...contasAlvo.map((accountId) => ({
                id: novoId("occ"),
                taskId,
                accountId,
                dueDate: vencimento,
                completedAt: null,
                skipped: false,
              })),
            ],
          };
        });
      },

      alternarTarefa: (occurrenceId) => {
        atualizar((atual) => ({
          ...atual,
          taskOccurrences: atual.taskOccurrences.map((o) =>
            o.id === occurrenceId
              ? {
                  ...o,
                  completedAt: o.completedAt ? null : new Date().toISOString(),
                }
              : o,
          ),
        }));
      },

      criarMeta: (dados) => {
        atualizar((atual) => ({
          ...atual,
          goals: [
            ...atual.goals,
            {
              id: novoId("gol"),
              projectId: dados.projectId,
              accountId: dados.accountId,
              title: dados.title,
              metric: dados.metric,
              targetValue: toDbNumeric(dados.target),
              deadline: dados.deadline,
              achievedAt: null,
            },
          ],
        }));
      },

      registrarRecebimento: (dados) => {
        atualizar((atual) => {
          const valor = (
            Number(dados.tokenAmount) * Number(dados.priceUsd)
          ).toFixed(2);
          return {
            ...atual,
            airdropClaims: [
              ...atual.airdropClaims,
              {
                id: novoId("clm"),
                projectId: dados.projectId,
                accountId: dados.accountId,
                receivedAt: dados.receivedAt,
                tokenSymbol: dados.tokenSymbol.toUpperCase(),
                tokenAmount: dados.tokenAmount,
                priceUsd: dados.priceUsd,
                valueUsd: valor,
              },
            ],
          };
        });
      },

      restaurarOriginal: () => {
        store.restaurar();
      },
    }),
    [atualizar, store],
  );

  const valor = useMemo(
    () => ({ dataset, hoje, modificado, acoes }),
    [dataset, hoje, modificado, acoes],
  );

  return <DataContext.Provider value={valor}>{children}</DataContext.Provider>;
}

export function useDados(): Contexto {
  const contexto = useContext(DataContext);
  if (!contexto) {
    throw new Error("useDados precisa estar dentro de <DataProvider>.");
  }
  return contexto;
}
