import { describe, expect, it } from "vitest";

import {
  datasDevidas,
  datasParaMaterializar,
  janelaPadrao,
} from "@/lib/recurrence";
import { formatDateExtenso } from "@/lib/dates";

const janela = { de: "2026-08-01", ate: "2026-08-10" };

describe("datasDevidas", () => {
  it("diária preenche todos os dias da janela", () => {
    const datas = datasDevidas(
      { recorrencia: "daily", ancora: "2026-08-01" },
      janela,
    );
    expect(datas).toHaveLength(10);
    expect(datas[0]).toBe("2026-08-01");
    expect(datas.at(-1)).toBe("2026-08-10");
  });

  it("semanal mantém o dia da semana da âncora", () => {
    // 2026-08-04 é uma terça-feira.
    const datas = datasDevidas(
      { recorrencia: "weekly", ancora: "2026-08-04" },
      { de: "2026-08-01", ate: "2026-08-31" },
    );
    expect(datas).toEqual([
      "2026-08-04",
      "2026-08-11",
      "2026-08-18",
      "2026-08-25",
    ]);
  });

  it("a cada N dias respeita o intervalo", () => {
    expect(
      datasDevidas(
        { recorrencia: "every_n_days", intervaloDias: 3, ancora: "2026-08-01" },
        janela,
      ),
    ).toEqual(["2026-08-01", "2026-08-04", "2026-08-07", "2026-08-10"]);
  });

  it("intervalo ausente ou zero não vira laço infinito nem série diária", () => {
    const semIntervalo = datasDevidas(
      { recorrencia: "every_n_days", ancora: "2026-08-01" },
      janela,
    );
    expect(semIntervalo).toEqual([]);
    expect(
      datasDevidas(
        { recorrencia: "every_n_days", intervaloDias: 0, ancora: "2026-08-01" },
        janela,
      ),
    ).toEqual([]);
  });

  /*
   * Mensal do dia 31: fevereiro não tem 31, e a aritmética ingênua escorregaria
   * para 2 ou 3 de março, empurrando toda a série para longe do combinado.
   */
  it("mensal do dia 31 cai no último dia dos meses curtos", () => {
    const datas = datasDevidas(
      { recorrencia: "monthly", ancora: "2026-01-31" },
      { de: "2026-01-01", ate: "2026-05-01" },
    );
    expect(datas).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("mensal volta ao dia original depois de um mês curto", () => {
    const datas = datasDevidas(
      { recorrencia: "monthly", ancora: "2026-01-31" },
      { de: "2026-03-01", ate: "2026-03-31" },
    );
    expect(datas).toEqual(["2026-03-31"]);
  });

  it("prazo fixo é uma data só, e só se cair na janela", () => {
    expect(
      datasDevidas({ recorrencia: "none", ancora: "2026-08-05" }, janela),
    ).toEqual(["2026-08-05"]);
    expect(
      datasDevidas({ recorrencia: "none", ancora: "2026-09-05" }, janela),
    ).toEqual([]);
  });

  it("âncora antiga não gera as datas passadas, só as da janela", () => {
    const datas = datasDevidas(
      { recorrencia: "daily", ancora: "2020-01-01" },
      { de: "2026-08-08", ate: "2026-08-10" },
    );
    expect(datas).toEqual(["2026-08-08", "2026-08-09", "2026-08-10"]);
  });

  it("âncora no futuro só rende datas a partir dela", () => {
    expect(
      datasDevidas({ recorrencia: "daily", ancora: "2026-08-09" }, janela),
    ).toEqual(["2026-08-09", "2026-08-10"]);
  });

  /*
   * Datas de calendário, não instantes: somar 24h atravessando horário de verão
   * produziria 23h ou 25h e deslocaria a série em um dia.
   */
  it("atravessa virada de mês e de ano sem pular dia", () => {
    expect(
      datasDevidas(
        { recorrencia: "daily", ancora: "2026-12-30" },
        { de: "2026-12-30", ate: "2027-01-02" },
      ),
    ).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

describe("janelaPadrao", () => {
  /*
   * O limite à frente é amplo de propósito desde que o corte passou a ser por
   * contagem: a janela só precisa ser larga o bastante para uma recorrência
   * mensal encontrar as próximas dentro dela. Quem limita é
   * `datasParaMaterializar`.
   */
  it("cobre uma semana atrás e um horizonte largo à frente", () => {
    const { de, ate } = janelaPadrao("2026-08-11");
    expect(de).toBe("2026-08-04");
    expect(ate > "2027-01-01").toBe(true);
  });

  it("o atrasado da semana passada continua visível", () => {
    const { de, ate } = janelaPadrao("2026-08-11");
    const datas = datasDevidas({ recorrencia: "daily", ancora: "2026-08-01" }, { de, ate });
    expect(datas).toContain("2026-08-04");
    expect(datas).not.toContain("2026-08-03");
  });
});

describe("formatDateExtenso", () => {
  it("escreve a data sem ordem a interpretar", () => {
    expect(formatDateExtenso("2026-08-11")).toBe("11 de agosto de 2026");
  });

  /*
   * O caso que motivou a mudança: 08/11 e 11/08 são a mesma data em formatos
   * diferentes, e mostrar um embaixo do outro levantava a dúvida.
   */
  it("distingue datas que trocadas pareceriam iguais", () => {
    expect(formatDateExtenso("2026-11-08")).toBe("8 de novembro de 2026");
    expect(formatDateExtenso("2026-08-11")).not.toBe(
      formatDateExtenso("2026-11-08"),
    );
  });

  it("não usa zero à esquerda no dia", () => {
    expect(formatDateExtenso("2026-01-05")).toBe("5 de janeiro de 2026");
  });
});

describe("reagendar tarefa recorrente", () => {
  /*
   * Ao editar a data de uma recorrente, `dueDate` é a âncora da série, não a
   * data de uma ocorrência. Empurrar todas as pendentes para a mesma data
   * violava unique(task_id, account_id, due_date) e derrubava a ação inteira.
   * O correto é apagar as futuras e deixar o motor recriá-las pela nova âncora.
   */
  it("a nova âncora gera uma série diferente da anterior", () => {
    const janela = { de: "2026-08-12", ate: "2026-08-20" };
    const antes = datasDevidas(
      { recorrencia: "weekly", ancora: "2026-08-12" },
      janela,
    );
    const depois = datasDevidas(
      { recorrencia: "weekly", ancora: "2026-08-14" },
      janela,
    );
    expect(antes).toEqual(["2026-08-12", "2026-08-19"]);
    expect(depois).toEqual(["2026-08-14"]);
    expect(antes).not.toEqual(depois);
  });

  it("cada data da série é única: não há duas iguais para colidir", () => {
    const datas = datasDevidas(
      { recorrencia: "daily", ancora: "2026-08-01" },
      { de: "2026-08-01", ate: "2026-08-31" },
    );
    expect(new Set(datas).size).toBe(datas.length);
  });
});

describe("datasParaMaterializar", () => {
  const hoje = "2026-08-12";

  /*
   * O defeito que motivou a mudança: a janela de trinta dias criava trinta
   * linhas de uma tarefa diária, e a tela mostra só a próxima.
   */
  it("diária cria poucas datas futuras, não um mês inteiro", () => {
    const datas = datasParaMaterializar(
      { recorrencia: "daily", ancora: hoje },
      hoje,
    );
    const futuras = datas.filter((d) => d >= hoje);
    expect(futuras).toEqual(["2026-08-12", "2026-08-13", "2026-08-14"]);
  });

  /*
   * O defeito oposto, na mesma janela: trinta dias mal alcançavam a próxima
   * ocorrência de uma tarefa mensal.
   */
  it("mensal alcança os próximos meses, que trinta dias não cobririam", () => {
    const datas = datasParaMaterializar(
      { recorrencia: "monthly", ancora: "2026-08-12" },
      hoje,
    );
    expect(datas).toEqual(["2026-08-12", "2026-09-12", "2026-10-12"]);
  });

  it("atrasadas não entram na contagem: são dívida, não previsão", () => {
    const datas = datasParaMaterializar(
      { recorrencia: "daily", ancora: "2026-08-05" },
      hoje,
    );
    const atrasadas = datas.filter((d) => d < hoje);
    const futuras = datas.filter((d) => d >= hoje);
    // A janela cobre sete dias para trás, e as próximas seguem limitadas a três.
    expect(atrasadas.length).toBeGreaterThan(3);
    expect(futuras).toHaveLength(3);
  });

  it("prazo fixo continua sendo uma data só", () => {
    expect(
      datasParaMaterializar({ recorrencia: "none", ancora: "2026-08-20" }, hoje),
    ).toEqual(["2026-08-20"]);
  });

  it("semanal conta semanas, não dias", () => {
    const datas = datasParaMaterializar(
      { recorrencia: "weekly", ancora: "2026-08-12" },
      hoje,
    );
    expect(datas).toEqual(["2026-08-12", "2026-08-19", "2026-08-26"]);
  });
})
