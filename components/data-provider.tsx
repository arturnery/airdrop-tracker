"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import * as A from "@/actions";
import * as M from "@/lib/mutations";
import type { Dataset } from "@/lib/dataset";
import { criarRelogio } from "@/lib/local-store";

/**
 * Acesso aos dados e às operações de escrita.
 *
 * O Dataset chega pronto do servidor (`carregarDataset`) e as escritas vão para
 * Server Actions. Não há mais estado local: o servidor é a única fonte de
 * verdade, e `router.refresh()` recarrega o que mudou.
 *
 * O contexto continua existindo por dois motivos. As telas já consomem
 * `useDados()`: trocar por props atravessando cinco níveis não melhoraria nada
 *: e a interface das ações permaneceu a mesma do modo local, então nenhum
 * componente precisou mudar quando o banco entrou.
 */

/** Resultado de uma escrita: `null` deu certo; objeto = erros por campo. */
export type ErrosDeCampo = Record<string, string> | null;

type Acao<T extends unknown[]> = (...args: T) => Promise<ErrosDeCampo>;

type Resultado = { ok: true } | { ok: false; erros: Record<string, string> };

type Acoes = {
  criarProjeto: Acao<[unknown]>;
  atualizarProjeto: Acao<[string, unknown]>;
  excluirProjeto: Acao<[string]>;

  criarConta: Acao<[unknown]>;
  atualizarConta: Acao<[string, unknown]>;
  excluirConta: Acao<[string]>;

  vincularConta: Acao<[unknown]>;
  desvincularConta: Acao<[string, string]>;

  criarLancamento: Acao<[unknown]>;
  atualizarLancamento: Acao<[string, unknown]>;
  excluirLancamento: Acao<[string]>;

  definirCotacao: Acao<[unknown]>;
  excluirCotacao: Acao<[string]>;

  registrarPontos: Acao<[unknown]>;
  excluirPontos: Acao<[string]>;

  criarTarefa: Acao<[unknown]>;
  atualizarTarefa: Acao<[string, unknown]>;
  excluirTarefa: Acao<[string]>;
  alternarTarefa: Acao<[string]>;

  criarMeta: Acao<[unknown]>;
  excluirMeta: Acao<[string]>;

  registrarRecebimento: Acao<[unknown]>;
  excluirRecebimento: Acao<[string]>;
};

type Contexto = {
  dataset: Dataset;
  hoje: string;
  /** true enquanto uma escrita está em andamento. */
  salvando: boolean;
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
  const router = useRouter();
  const [salvando, iniciarTransicao] = useTransition();
  const [relogio] = useState(() => criarRelogio(initialToday));

  /**
   * Marcar tarefa é a única escrita feita com um clique, sem formulário para
   * dar retorno. Esperar o servidor deixava o check parado por um tempo longo
   * o bastante para parecer que o clique não pegou: escrita no banco, mais
   * revalidação das rotas, mais recarga do dataset inteiro.
   *
   * Aqui o estado muda na hora e o servidor confirma depois. Se a escrita
   * falhar, o React descarta o palpite sozinho ao fim da transição e a tela
   * volta ao que o banco diz.
   *
   * A transformação é a mesma função pura de `lib/mutations`, escrita quando os
   * dados ainda eram locais: por não conhecer a origem dos dados, serviu sem
   * alteração nenhuma.
   */
  const [dataset, aplicarOtimista] = useOptimistic(
    initialDataset,
    (atual: Dataset, occurrenceId: string) =>
      M.alternarOcorrencia(atual, occurrenceId),
  );

  /**
   * A data vem de store externo porque o relógio é externo ao React: o HTML do
   * servidor carrega a constante e o navegador corrige ao hidratar, sem
   * divergência de hidratação.
   */
  const hoje = useSyncExternalStore(
    relogio.subscribe,
    relogio.getSnapshot,
    relogio.getServerSnapshot,
  );

  /**
   * Envolve uma Server Action: devolve os erros de validação para o formulário
   * e, quando dá certo, recarrega os dados do servidor.
   */
  const envolver = useCallback(
    <T extends unknown[]>(acao: (...args: T) => Promise<Resultado>): Acao<T> =>
      async (...args: T) => {
        const resultado = await acao(...args);
        if (!resultado.ok) return resultado.erros;
        iniciarTransicao(() => router.refresh());
        return null;
      },
    [router],
  );

  /**
   * Alternar tarefa não passa por `envolver`: precisa pintar o check antes de
   * chamar o servidor, e `aplicarOtimista` só vale dentro de uma transição.
   */
  const alternarTarefa = useCallback<Acao<[string]>>(
    async (id) => {
      iniciarTransicao(async () => {
        aplicarOtimista(id);
        const resultado = await A.alternarOcorrencia(id);
        // Deu certo: busca o estado real. Deu errado: não recarrega, e o
        // palpite é descartado quando a transição fecha.
        if (resultado.ok) router.refresh();
      });
      return null;
    },
    [aplicarOtimista, router],
  );

  const acoes = useMemo<Acoes>(
    () => ({
      criarProjeto: envolver(A.criarProjeto),
      atualizarProjeto: envolver(A.atualizarProjeto),
      excluirProjeto: envolver(A.excluirProjeto),

      criarConta: envolver(A.criarConta),
      atualizarConta: envolver(A.atualizarConta),
      excluirConta: envolver(A.excluirConta),

      vincularConta: envolver(A.vincularConta),
      desvincularConta: envolver(A.desvincularConta),

      criarLancamento: envolver(A.criarLancamento),
      atualizarLancamento: envolver(A.atualizarLancamento),
      excluirLancamento: envolver(A.excluirLancamento),

      definirCotacao: envolver(A.definirCotacao),
      excluirCotacao: envolver(A.excluirCotacao),

      registrarPontos: envolver(A.registrarPontos),
      excluirPontos: envolver(A.excluirPontos),

      criarTarefa: envolver(A.criarTarefa),
      atualizarTarefa: envolver(A.atualizarTarefa),
      excluirTarefa: envolver(A.excluirTarefa),
      alternarTarefa,

      criarMeta: envolver(A.criarMeta),
      excluirMeta: envolver(A.excluirMeta),

      registrarRecebimento: envolver(A.registrarRecebimento),
      excluirRecebimento: envolver(A.excluirRecebimento),
    }),
    [envolver, alternarTarefa],
  );

  const valor = useMemo(
    () => ({ dataset, hoje, salvando, acoes }),
    [dataset, hoje, salvando, acoes],
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
