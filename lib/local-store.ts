import { dataDeHoje } from "./dates";
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
 *
 * **O dia precisa virar com a tela aberta.** A primeira versão calculava a
 * data uma vez e a guardava "durante a sessão", e a sessão de quem usa isto
 * todo dia dura mais que um dia: a aba fica aberta, meia-noite passa, e o
 * formulário continua oferecendo ontem. Oito lançamentos de um mesmo dia
 * foram gravados com a data anterior desse jeito, e nada na tela sugeria o
 * motivo, porque a data aparecia preenchida e plausível.
 *
 * Por isso `getSnapshot` calcula na hora, e `subscribe` avisa o React quando o
 * dia muda, para uma tela parada se corrigir sozinha em vez de esperar o
 * próximo clique.
 *
 * A conferência é por intervalo, e não por um `setTimeout` até a meia-noite:
 * navegador em segundo plano estrangula temporizadores longos e aparelho que
 * dorme não os executa, então o alarme da meia-noite chegaria tarde ou nunca.
 * Um minuto de intervalo custa nada e erra por no máximo um minuto; `focus` e
 * `visibilitychange` cobrem quem volta para a aba depois de horas.
 */
const INTERVALO_MS = 60_000;

export function criarRelogio(dataInicial: string) {
  const ouvintes = new Set<() => void>();
  let ultimoDia = dataInicial;

  const conferir = () => {
    const agora = dataDeHoje();
    if (agora === ultimoDia) return;
    ultimoDia = agora;
    for (const avisar of ouvintes) avisar();
  };

  return {
    subscribe: (aoMudar: () => void) => {
      ouvintes.add(aoMudar);
      const timer = window.setInterval(conferir, INTERVALO_MS);
      window.addEventListener("visibilitychange", conferir);
      window.addEventListener("focus", conferir);

      return () => {
        ouvintes.delete(aoMudar);
        window.clearInterval(timer);
        window.removeEventListener("visibilitychange", conferir);
        window.removeEventListener("focus", conferir);
      };
    },
    /*
     * Calcula sempre. Devolver uma string nova a cada chamada é seguro porque
     * o React compara por valor, e duas strings iguais são a mesma coisa para
     * `Object.is`: não há render extra enquanto o dia não muda.
     */
    getSnapshot: (): string => dataDeHoje(),
    getServerSnapshot: (): string => dataInicial,
  };
}
