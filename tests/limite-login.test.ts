import { describe, expect, it } from "vitest";

import { bloqueadoPor, JANELA_MINUTOS, LIMITE } from "@/lib/limite-login";

const AGORA = new Date("2026-08-13T12:00:00Z");

/** `n` falhas, todas há `minutosAtras` minutos. */
function falhas(n: number, minutosAtras: number): Date[] {
  return Array.from(
    { length: n },
    () => new Date(AGORA.getTime() - minutosAtras * 60 * 1000),
  );
}

describe("limite de tentativas de login", () => {
  it("deixa passar quem nunca errou", () => {
    expect(bloqueadoPor([], AGORA)).toBe(false);
  });

  it("deixa passar até uma falha antes do limite", () => {
    expect(bloqueadoPor(falhas(LIMITE - 1, 1), AGORA)).toBe(false);
  });

  it("bloqueia ao atingir o limite dentro da janela", () => {
    expect(bloqueadoPor(falhas(LIMITE, 1), AGORA)).toBe(true);
  });

  it("solta quando as falhas envelhecem além da janela", () => {
    expect(bloqueadoPor(falhas(LIMITE, JANELA_MINUTOS + 1), AGORA)).toBe(false);
  });

  it("ignora as falhas velhas ao contar as recentes", () => {
    // Quatro recentes e muitas antigas: as antigas não podem completar o limite,
    // senão quem errou meses atrás começaria bloqueado com uma falha só.
    const mistura = [...falhas(LIMITE - 1, 2), ...falhas(20, JANELA_MINUTOS * 3)];
    expect(bloqueadoPor(mistura, AGORA)).toBe(false);
  });

  it("conta a falha que acabou de acontecer", () => {
    expect(bloqueadoPor(falhas(LIMITE, 0), AGORA)).toBe(true);
  });

  it("libera exatamente na borda da janela", () => {
    // Na borda o bloqueio já saiu: uma janela de quinze minutos que segurasse
    // no minuto quinze seria, na prática, uma janela maior do que a anunciada.
    expect(bloqueadoPor(falhas(LIMITE, JANELA_MINUTOS), AGORA)).toBe(false);
  });
});
