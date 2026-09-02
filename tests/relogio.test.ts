import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dataDeHoje } from "@/lib/dates";
import { criarRelogio } from "@/lib/local-store";

/**
 * O relógio da tela precisa virar o dia sozinho.
 *
 * O caso real: oito lançamentos feitos numa tarde foram gravados com a data do
 * dia anterior. A causa não estava no formulário nem no banco, e sim aqui: a
 * data era calculada uma vez e guardada "durante a sessão". A sessão de quem
 * usa isto todo dia dura mais que um dia.
 *
 * Por isso os testes abaixo medem **a virada**, e não o valor: um relógio que
 * acerta a data de hoje e nunca mais muda passaria em qualquer teste que só
 * olhasse uma leitura.
 */

/*
 * 16h de Brasília, que é a hora em que os oito lançamentos foram feitos, e o
 * dia seguinte à mesma hora. Longe da meia-noite de propósito: `advanceTimersByTime`
 * também move o relógio, e um teste começando às 23h59 viraria o dia por conta
 * dos próprios minutos que ele adianta.
 */
const ANTES_DA_VIRADA = new Date("2026-09-01T19:00:00Z");
const DEPOIS_DA_VIRADA = new Date("2026-09-02T19:00:00Z");

/** 23h59 de 1º de setembro em Brasília, que já é dia 2 em UTC. */
const NOITE_DE_BRASILIA = new Date("2026-09-02T02:59:00Z");

type Ouvinte = () => void;

/**
 * `window` mínimo. Os testes rodam em Node, e o relógio usa `window` porque só
 * existe no navegador: estes três métodos são tudo o que ele toca.
 */
function janelaFalsa() {
  const porEvento = new Map<string, Set<Ouvinte>>();

  return {
    setInterval: (fn: () => void, ms: number) =>
      globalThis.setInterval(fn, ms) as unknown as number,
    clearInterval: (id: number) => globalThis.clearInterval(id),
    addEventListener: (nome: string, fn: Ouvinte) => {
      if (!porEvento.has(nome)) porEvento.set(nome, new Set());
      porEvento.get(nome)!.add(fn);
    },
    removeEventListener: (nome: string, fn: Ouvinte) => {
      porEvento.get(nome)?.delete(fn);
    },
    disparar: (nome: string) => {
      for (const fn of porEvento.get(nome) ?? []) fn();
    },
    quantosOuvem: () =>
      [...porEvento.values()].reduce((total, s) => total + s.size, 0),
  };
}

let janela: ReturnType<typeof janelaFalsa>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ANTES_DA_VIRADA);
  janela = janelaFalsa();
  Object.defineProperty(globalThis, "window", {
    value: janela,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "window");
});

describe("data de hoje", () => {
  it("usa o fuso de Brasília, e não o UTC", () => {
    // Às 23h59 de Brasília o UTC já virou. O dia certo é o de cá.
    expect(dataDeHoje(NOITE_DE_BRASILIA)).toBe("2026-09-01");
    expect(dataDeHoje(ANTES_DA_VIRADA)).toBe("2026-09-01");
    expect(dataDeHoje(DEPOIS_DA_VIRADA)).toBe("2026-09-02");
  });
});

describe("relógio da tela", () => {
  it("corrige a data quando o dia vira com a tela aberta", () => {
    const relogio = criarRelogio("2026-09-01");
    relogio.subscribe(() => {});

    expect(relogio.getSnapshot()).toBe("2026-09-01");

    vi.setSystemTime(DEPOIS_DA_VIRADA);

    expect(relogio.getSnapshot()).toBe("2026-09-02");
  });

  it("avisa o React na virada, sem esperar o próximo clique", () => {
    const relogio = criarRelogio("2026-09-01");
    const avisado = vi.fn();
    relogio.subscribe(avisado);

    vi.advanceTimersByTime(60_000);
    expect(avisado, "mesmo dia não avisa").not.toHaveBeenCalled();

    vi.setSystemTime(DEPOIS_DA_VIRADA);
    vi.advanceTimersByTime(60_000);

    expect(avisado).toHaveBeenCalledTimes(1);
  });

  it("avisa só uma vez por dia, e não a cada conferência", () => {
    const relogio = criarRelogio("2026-09-01");
    const avisado = vi.fn();
    relogio.subscribe(avisado);

    vi.setSystemTime(DEPOIS_DA_VIRADA);
    vi.advanceTimersByTime(60_000 * 5);

    expect(avisado).toHaveBeenCalledTimes(1);
  });

  /*
   * Aba em segundo plano tem o temporizador estrangulado, e aparelho que dorme
   * não o executa: quem volta depois de horas precisa da data certa na hora,
   * não no minuto seguinte.
   */
  it("confere ao voltar para a aba", () => {
    const relogio = criarRelogio("2026-09-01");
    const avisado = vi.fn();
    relogio.subscribe(avisado);

    vi.setSystemTime(DEPOIS_DA_VIRADA);
    janela.disparar("visibilitychange");

    expect(avisado).toHaveBeenCalledTimes(1);
  });

  it("desfaz tudo o que criou ao cancelar a inscrição", () => {
    const relogio = criarRelogio("2026-09-01");
    const avisado = vi.fn();
    const cancelar = relogio.subscribe(avisado);

    expect(janela.quantosOuvem()).toBe(2);
    cancelar();
    expect(janela.quantosOuvem(), "ouvinte deixado para trás").toBe(0);

    vi.setSystemTime(DEPOIS_DA_VIRADA);
    vi.advanceTimersByTime(60_000);
    expect(avisado, "temporizador deixado rodando").not.toHaveBeenCalled();
  });

  /* O servidor não tem relógio do navegador: ele entrega a data que calculou. */
  it("no servidor devolve a data que veio pronta", () => {
    const relogio = criarRelogio("2026-09-01");
    vi.setSystemTime(DEPOIS_DA_VIRADA);

    expect(relogio.getServerSnapshot()).toBe("2026-09-01");
  });
});
