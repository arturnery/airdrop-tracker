import { describe, expect, it } from "vitest";

import {
  diaEHoraDeBrasilia,
  formatarQuando,
  instanteDeBrasilia,
  proximasOcorrencias,
  type Live,
} from "@/lib/lives";

const live = (sobre: Partial<Live>): Live => ({
  id: "l1",
  titulo: "Live de terça",
  descricao: null,
  link: null,
  inicioEm: instanteDeBrasilia("2026-10-06", "20:00"),
  semanal: false,
  ...sobre,
});

// Quarta, 14/10/2026, 10:00 em Brasília.
const agora = new Date(instanteDeBrasilia("2026-10-14", "10:00"));

describe("instanteDeBrasilia", () => {
  it("20:00 em Brasília é 23:00 UTC, o ano todo", () => {
    expect(instanteDeBrasilia("2026-10-14", "20:00")).toBe("2026-10-14T23:00:00.000Z");
    expect(instanteDeBrasilia("2026-01-14", "20:00")).toBe("2026-01-14T23:00:00.000Z");
  });

  it("perto da meia-noite, o dia UTC é o seguinte, e a volta preserva o dia de Brasília", () => {
    const iso = instanteDeBrasilia("2026-10-14", "22:30");
    expect(iso).toBe("2026-10-15T01:30:00.000Z");
    expect(diaEHoraDeBrasilia(iso)).toEqual({ dia: "2026-10-14", hora: "22:30" });
  });
});

describe("proximasOcorrencias", () => {
  it("live única no passado não aparece; no futuro dentro da janela, aparece", () => {
    const passada = live({ id: "a", inicioEm: instanteDeBrasilia("2026-10-01", "20:00") });
    const futura = live({ id: "b", inicioEm: instanteDeBrasilia("2026-10-16", "20:00") });
    const longe = live({ id: "c", inicioEm: instanteDeBrasilia("2026-12-01", "20:00") });
    expect(proximasOcorrencias([passada, futura, longe], agora, 14).map((o) => o.liveId)).toEqual(["b"]);
  });

  it("semanal começa na próxima semana ainda não passada, e repete dentro da janela", () => {
    // Cadastrada para 06/10 (terça): as próximas são 20/10 e 27/10.
    const semanal = live({ semanal: true });
    const datas = proximasOcorrencias([semanal], agora, 14).map((o) => o.quando);
    expect(datas).toEqual([
      instanteDeBrasilia("2026-10-20", "20:00"),
      instanteDeBrasilia("2026-10-27", "20:00"),
    ]);
  });

  it("semanal cadastrada para o futuro só começa a contar nela", () => {
    // Janela até 28/10: entra 22/10, e 29/10 fica de fora.
    const semanal = live({ semanal: true, inicioEm: instanteDeBrasilia("2026-10-22", "19:00") });
    expect(proximasOcorrencias([semanal], agora, 14).map((o) => o.quando)).toEqual([
      instanteDeBrasilia("2026-10-22", "19:00"),
    ]);
  });

  it("quem começou há menos de duas horas continua listada, marcada como ao vivo", () => {
    const comecou = live({ inicioEm: instanteDeBrasilia("2026-10-14", "09:00") });
    const [o] = proximasOcorrencias([comecou], agora, 14);
    expect(o!.aoVivo).toBe(true);

    const acabou = live({ inicioEm: instanteDeBrasilia("2026-10-14", "07:30") });
    expect(proximasOcorrencias([acabou], agora, 14)).toEqual([]);
  });

  it("semanal no ar agora aparece como ao vivo, e a da semana seguinte não", () => {
    const semanal = live({ semanal: true, inicioEm: instanteDeBrasilia("2026-10-07", "09:30") });
    const [primeira, segunda] = proximasOcorrencias([semanal], agora, 14);
    expect(primeira!.aoVivo).toBe(true);
    expect(segunda!.aoVivo).toBe(false);
  });

  it("várias lives saem em ordem de data", () => {
    const tarde = live({ id: "t", inicioEm: instanteDeBrasilia("2026-10-15", "20:00") });
    const cedo = live({ id: "c", inicioEm: instanteDeBrasilia("2026-10-15", "08:00") });
    expect(proximasOcorrencias([tarde, cedo], agora, 14).map((o) => o.liveId)).toEqual(["c", "t"]);
  });
});

describe("formatarQuando", () => {
  it("mostra o horário de Brasília, não o do servidor", () => {
    expect(formatarQuando(instanteDeBrasilia("2026-10-14", "20:00"))).toMatch(/14\/10.*20:00/);
  });
});
