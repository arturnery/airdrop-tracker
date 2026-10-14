import { describe, expect, it } from "vitest";

import {
  deslocarMes,
  diaEHoraDeBrasilia,
  formatarQuando,
  horaCurta,
  instanteDeBrasilia,
  lerMes,
  limitesDoMes,
  nomeDoDia,
  nomeDoMes,
  ocorrenciasEntre,
  semanasDoMes,
  type Live,
} from "@/lib/lives";

const live = (sobre: Partial<Live>): Live => ({
  id: "l1",
  titulo: "TradFi",
  apresentador: "Stoncks",
  descricao: null,
  link: null,
  inicioEm: instanteDeBrasilia("2026-03-02", "18:00"),
  recorrencia: "nenhuma",
  repetirAte: null,
  destaque: false,
  ...sobre,
});

const marco = limitesDoMes("2026-03");
const muitoDepois = new Date("2030-01-01T00:00:00Z");
const diasDe = (lista: Live[], agora = muitoDepois) =>
  ocorrenciasEntre(lista, marco.de, marco.ate, agora).map((o) => o.dia);

describe("horário de Brasília", () => {
  it("20:00 em Brasília é 23:00 UTC, o ano todo", () => {
    expect(instanteDeBrasilia("2026-10-14", "20:00")).toBe("2026-10-14T23:00:00.000Z");
    expect(instanteDeBrasilia("2026-01-14", "20:00")).toBe("2026-01-14T23:00:00.000Z");
  });

  it("perto da meia-noite, o dia UTC é o seguinte, e a volta preserva o dia de Brasília", () => {
    const iso = instanteDeBrasilia("2026-10-14", "22:30");
    expect(iso).toBe("2026-10-15T01:30:00.000Z");
    expect(diaEHoraDeBrasilia(iso)).toEqual({ dia: "2026-10-14", hora: "22:30" });
  });

  it("hora curta como numa grade de programação", () => {
    expect(horaCurta(instanteDeBrasilia("2026-03-03", "18:30"))).toBe("18h30");
    expect(horaCurta(instanteDeBrasilia("2026-03-03", "20:00"))).toBe("20h");
    expect(horaCurta(instanteDeBrasilia("2026-03-07", "09:00"))).toBe("9h");
  });

  it("formatarQuando mostra o horário de Brasília, não o do servidor", () => {
    expect(formatarQuando(instanteDeBrasilia("2026-10-14", "20:00"))).toMatch(/14\/10.*20:00/);
  });
});

/*
 * Os casos abaixo são a grade de março de 2026 que motivou o calendário:
 * Stoncks quinzenal nas segundas 2, 16 e 30; 3rd Eye toda terça; Brunoshi todo
 * sábado; o especial do dia 13, uma vez só.
 */
describe("ocorrenciasEntre", () => {
  it("quinzenal: 2, 16 e 30 de março", () => {
    expect(diasDe([live({ recorrencia: "quinzenal" })])).toEqual([
      "2026-03-02",
      "2026-03-16",
      "2026-03-30",
    ]);
  });

  it("semanal: todas as terças do mês", () => {
    const terca = live({ inicioEm: instanteDeBrasilia("2026-03-03", "20:00"), recorrencia: "semanal" });
    expect(diasDe([terca])).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
      "2026-03-24",
      "2026-03-31",
    ]);
  });

  it("recorrente cadastrada em fevereiro continua no ritmo certo em março", () => {
    // Quinzenal começando 16/02: a próxima é 02/03, depois 16/03 e 30/03.
    const desdeFevereiro = live({
      inicioEm: instanteDeBrasilia("2026-02-16", "18:00"),
      recorrencia: "quinzenal",
    });
    expect(diasDe([desdeFevereiro])).toEqual(["2026-03-02", "2026-03-16", "2026-03-30"]);
  });

  it("repetir até um dia inclui esse dia e para depois dele", () => {
    const ate17 = live({
      inicioEm: instanteDeBrasilia("2026-03-03", "20:00"),
      recorrencia: "semanal",
      repetirAte: "2026-03-17",
    });
    expect(diasDe([ate17])).toEqual(["2026-03-03", "2026-03-10", "2026-03-17"]);
    const abril = limitesDoMes("2026-04");
    expect(ocorrenciasEntre([ate17], abril.de, abril.ate, muitoDepois)).toEqual([]);
  });

  it("recorrente que começa no meio do mês não aparece antes do começo", () => {
    const sabado = live({ inicioEm: instanteDeBrasilia("2026-03-14", "11:00"), recorrencia: "semanal" });
    expect(diasDe([sabado])).toEqual(["2026-03-14", "2026-03-21", "2026-03-28"]);
  });

  it("uma vez só: aparece no mês dela e em nenhum outro", () => {
    const especial = live({ inicioEm: instanteDeBrasilia("2026-03-13", "19:00"), destaque: true });
    expect(diasDe([especial])).toEqual(["2026-03-13"]);
    const abril = limitesDoMes("2026-04");
    expect(ocorrenciasEntre([especial], abril.de, abril.ate, muitoDepois)).toEqual([]);
  });

  it("live às 22h do último dia do mês fica no mês, mesmo já sendo o dia seguinte em UTC", () => {
    const tarde = live({ inicioEm: instanteDeBrasilia("2026-03-31", "22:00") });
    expect(diasDe([tarde])).toEqual(["2026-03-31"]);
  });

  it("várias no mesmo dia saem em ordem de horário", () => {
    const cedo = live({ id: "a", inicioEm: instanteDeBrasilia("2026-03-05", "17:00") });
    const tarde = live({ id: "b", inicioEm: instanteDeBrasilia("2026-03-05", "19:00") });
    const ordem = ocorrenciasEntre([tarde, cedo], marco.de, marco.ate, muitoDepois).map((o) => o.live.id);
    expect(ordem).toEqual(["a", "b"]);
  });

  it("ao vivo só nas duas horas depois de começar", () => {
    const l = live({ inicioEm: instanteDeBrasilia("2026-03-05", "19:00") });
    const as = (hora: string) => new Date(instanteDeBrasilia("2026-03-05", hora));
    const aoVivo = (agora: Date) => ocorrenciasEntre([l], marco.de, marco.ate, agora)[0]!.aoVivo;
    expect(aoVivo(as("18:59"))).toBe(false);
    expect(aoVivo(as("19:30"))).toBe(true);
    expect(aoVivo(as("21:01"))).toBe(false);
  });
});

describe("grade do mês", () => {
  it("março de 2026 começa num domingo e tem 5 semanas, como na imagem", () => {
    const semanas = semanasDoMes("2026-03");
    expect(semanas).toHaveLength(5);
    expect(semanas[0]![0]).toBe("2026-03-01");
    expect(semanas[4]).toEqual(["2026-03-29", "2026-03-30", "2026-03-31", null, null, null, null]);
  });

  it("mês que começa no meio da semana tem os primeiros dias vazios", () => {
    // Outubro de 2026 começa numa quinta.
    expect(semanasDoMes("2026-10")[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("navegar entre meses atravessa a virada do ano", () => {
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
  });

  it("parâmetro de mês inválido é ignorado", () => {
    expect(lerMes("2026-03")).toBe("2026-03");
    expect(lerMes("2026-13")).toBeNull();
    expect(lerMes("março")).toBeNull();
    expect(lerMes(undefined)).toBeNull();
  });

  it("nome do mês e do dia com maiúscula só na primeira letra", () => {
    expect(nomeDoMes("2026-03")).toBe("Março de 2026");
    expect(nomeDoDia("2026-03-02")).toBe("Segunda-feira, 02/03");
  });
});
