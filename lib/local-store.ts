import type { Dataset } from "./dataset";

/**
 * Store externo do modo local, consumido via `useSyncExternalStore`.
 *
 * O localStorage é um sistema externo ao React, e ler dele depois da
 * hidratação é exatamente o caso que `useSyncExternalStore` existe para
 * resolver: `getServerSnapshot` devolve as fixtures (o que o servidor
 * renderizou) e `getSnapshot` devolve o que está salvo no navegador. Sem
 * isso, a alternativa seria um `setState` dentro de `useEffect`, que dispara
 * renderização em cascata.
 *
 * O snapshot é memorizado: `getSnapshot` precisa devolver a MESMA referência
 * entre chamadas, senão o React entra em laço infinito de renderização.
 */

const CHAVE = "airdrop-tracker:dataset:v1";

type Listener = () => void;

export class DatasetStore {
  private listeners = new Set<Listener>();
  private cache: Dataset | null = null;
  private readonly base: Dataset;
  private alterado = false;

  constructor(base: Dataset) {
    this.base = base;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): Dataset => {
    if (this.cache) return this.cache;
    try {
      const salvo = window.localStorage.getItem(CHAVE);
      if (salvo) {
        this.cache = JSON.parse(salvo) as Dataset;
        this.alterado = true;
        return this.cache;
      }
    } catch {
      // localStorage indisponível (modo privado, cota): segue com as fixtures.
    }
    this.cache = this.base;
    return this.cache;
  };

  /** No servidor não existe localStorage: sempre as fixtures. */
  getServerSnapshot = (): Dataset => this.base;

  foiAlterado = (): boolean => this.alterado;

  atualizar = (fn: (atual: Dataset) => Dataset): void => {
    const proximo = fn(this.getSnapshot());
    this.cache = proximo;
    this.alterado = true;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(proximo));
    } catch {
      // Sem persistência; o estado em memória continua valendo na sessão.
    }
    this.emitir();
  };

  restaurar = (): void => {
    try {
      window.localStorage.removeItem(CHAVE);
    } catch {
      // nada para limpar
    }
    this.cache = this.base;
    this.alterado = false;
    this.emitir();
  };

  private emitir() {
    for (const listener of this.listeners) listener();
  }
}

/**
 * Data de hoje como store externo: o relógio também é externo ao React.
 * O valor é calculado uma vez e fica estável durante a sessão.
 */
export function criarRelogio(dataInicial: string) {
  let cache: string | null = null;
  return {
    subscribe: () => () => {},
    getSnapshot: (): string => {
      if (cache) return cache;
      const agora = new Date();
      const mes = String(agora.getMonth() + 1).padStart(2, "0");
      const dia = String(agora.getDate()).padStart(2, "0");
      cache = `${agora.getFullYear()}-${mes}-${dia}`;
      return cache;
    },
    getServerSnapshot: (): string => dataInicial,
  };
}
