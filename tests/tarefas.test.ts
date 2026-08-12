import { describe, expect, it } from "vitest";

import {
  contasAlvoDaTarefa,
  contasDisponiveisNoProjeto,
} from "@/lib/tarefas";

describe("contasAlvoDaTarefa", () => {
  it("conta escolhida vence tudo", () => {
    expect(contasAlvoDaTarefa("c1", ["c2", "c3"], ["c1", "c2", "c3"])).toEqual(["c1"]);
  });

  it("sem escolha, usa as contas vinculadas ao projeto", () => {
    expect(contasAlvoDaTarefa(null, ["c2", "c3"], ["c1", "c2", "c3"])).toEqual([
      "c2",
      "c3",
    ]);
  });

  /*
   * O caso que quebrou em produção: projeto criado agora, sem lançamento, logo
   * sem vínculo. Antes devolvia lista vazia e a tarefa nascia invisível.
   */
  it("projeto sem vínculo cai para todas as contas da pessoa", () => {
    expect(contasAlvoDaTarefa(null, [], ["c1"])).toEqual(["c1"]);
  });

  it("conta única e campo em branco alcançam a mesma conta", () => {
    expect(contasAlvoDaTarefa(null, [], ["c1"])).toEqual(
      contasAlvoDaTarefa("c1", [], ["c1"]),
    );
  });

  it("pessoa sem conta nenhuma devolve vazio, e quem chama recusa", () => {
    expect(contasAlvoDaTarefa(null, [], [])).toEqual([]);
  });

  it("string vazia conta como não escolhida", () => {
    expect(contasAlvoDaTarefa("", [], ["c1"])).toEqual(["c1"]);
  });
});

describe("contasDisponiveisNoProjeto", () => {
  it("projeto com vínculos oferece só as contas dele", () => {
    expect(contasDisponiveisNoProjeto(["c2"], ["c1", "c2", "c3"])).toEqual(["c2"]);
  });

  it("projeto sem vínculo ainda oferece todas: é o primeiro lançamento", () => {
    expect(contasDisponiveisNoProjeto([], ["c1", "c2"])).toEqual(["c1", "c2"]);
  });

  /*
   * As duas regras precisam concordar: se a tarefa fosse criada para uma conta
   * em que não se pode lançar, a tela cobraria algo impossível de cumprir.
   */
  it("concorda com o alvo das tarefas quando não há conta escolhida", () => {
    expect(contasDisponiveisNoProjeto(["c1"], ["c1", "c2"])).toEqual(
      contasAlvoDaTarefa(null, ["c1"], ["c1", "c2"]),
    );
  });
});
