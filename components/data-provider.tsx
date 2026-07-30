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

import type { Dataset } from "@/lib/dataset";
import { criarRelogio, DatasetStore } from "@/lib/local-store";
import type { Cents } from "@/lib/money";
import * as M from "@/lib/mutations";

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
    category: Dataset["projects"][number]["category"];
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

  // ------------------------------------------------------------ edição
  atualizarProjeto: (
    id: string,
    dados: Partial<Omit<Dataset["projects"][number], "id" | "slug">>,
  ) => void;
  atualizarConta: (
    id: string,
    dados: Partial<Omit<Dataset["accounts"][number], "id">>,
  ) => void;
  atualizarTarefa: (
    id: string,
    dados: Partial<Omit<Dataset["tasks"][number], "id">>,
  ) => void;
  atualizarLancamento: (
    id: string,
    dados: { occurredAt: string; type: Dataset["transactions"][number]["type"]; amount: Cents; description: string | null },
  ) => void;
  atualizarSaldo: (id: string, dados: { takenAt: string; balance: Cents }) => void;
  atualizarVinculo: (
    projectId: string,
    accountId: string,
    dados: { status: "ativa" | "pausada" | "queimada"; startedAt: string },
  ) => void;

  // ----------------------------------------------------------- exclusão
  excluirProjeto: (id: string) => void;
  excluirConta: (id: string) => void;
  excluirLancamento: (id: string) => void;
  excluirSaldo: (id: string) => void;
  excluirTarefa: (taskId: string) => void;
  excluirOcorrencia: (id: string) => void;
  excluirMeta: (id: string) => void;
  excluirRecebimento: (id: string) => void;
  desvincularConta: (projectId: string, accountId: string) => void;

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
        let id = "";
        atualizar((atual) => {
          const r = M.criarProjeto(atual, dados);
          id = r.id;
          return r.dataset;
        });
        return id;
      },
      criarConta: (dados) => {
        let id = "";
        atualizar((atual) => {
          const r = M.criarConta(atual, dados);
          id = r.id;
          return r.dataset;
        });
        return id;
      },
      vincularConta: (d) => atualizar((a) => M.vincularConta(a, d)),
      criarLancamento: (d) => atualizar((a) => M.criarLancamento(a, d)),
      registrarSaldo: (d) => atualizar((a) => M.registrarSaldo(a, d)),
      criarTarefa: (d) => atualizar((a) => M.criarTarefa(a, d, hoje)),
      alternarTarefa: (id) => atualizar((a) => M.alternarOcorrencia(a, id)),
      criarMeta: (d) => atualizar((a) => M.criarMeta(a, d)),
      registrarRecebimento: (d) => atualizar((a) => M.registrarRecebimento(a, d)),

      atualizarProjeto: (id, d) => atualizar((a) => M.atualizarProjeto(a, id, d)),
      atualizarConta: (id, d) => atualizar((a) => M.atualizarConta(a, id, d)),
      atualizarTarefa: (id, d) => atualizar((a) => M.atualizarTarefa(a, id, d)),
      atualizarLancamento: (id, d) => atualizar((a) => M.atualizarLancamento(a, id, d)),
      atualizarSaldo: (id, d) => atualizar((a) => M.atualizarSaldo(a, id, d)),
      atualizarVinculo: (p, c, d) => atualizar((a) => M.atualizarVinculo(a, p, c, d)),

      excluirProjeto: (id) => atualizar((a) => M.excluirProjeto(a, id)),
      excluirConta: (id) => atualizar((a) => M.excluirConta(a, id)),
      excluirLancamento: (id) => atualizar((a) => M.excluirLancamento(a, id)),
      excluirSaldo: (id) => atualizar((a) => M.excluirSaldo(a, id)),
      excluirTarefa: (id) => atualizar((a) => M.excluirTarefa(a, id)),
      excluirOcorrencia: (id) => atualizar((a) => M.excluirOcorrencia(a, id)),
      excluirMeta: (id) => atualizar((a) => M.excluirMeta(a, id)),
      excluirRecebimento: (id) => atualizar((a) => M.excluirRecebimento(a, id)),
      desvincularConta: (p, c) => atualizar((a) => M.desvincularConta(a, p, c)),

      restaurarOriginal: () => store.restaurar(),
    }),
    [atualizar, store, hoje],
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
