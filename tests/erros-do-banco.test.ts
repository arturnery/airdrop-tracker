import { describe, expect, it } from "vitest";

import {
  MENSAGEM_GENERICA,
  traduzirErroDeBanco,
} from "@/lib/erros-do-banco";

/** O que o driver do Postgres entrega. */
const doDriver = (code: string, constraint?: string) => ({
  name: "NeonDbError",
  code,
  constraint,
  // O driver manda junto o valor que colidiu e o id do usuário. Nada daqui
  // pode aparecer numa mensagem: os testes abaixo verificam isso.
  detail: "Key (user_id, name)=(8b94168d-…, Meridian) already exists.",
  table: "projects",
});

/**
 * O que a aplicação realmente recebe.
 *
 * O Drizzle embrulha o erro do driver num `Error("Failed query: …")` e pendura o
 * original em `cause`. Os testes passam por aqui, e não pelo formato cru, porque
 * a primeira versão deste módulo lia `erro.code` do nível de fora: os testes
 * passavam com o objeto do driver e a tela continuava dizendo "tente de novo".
 * Testar o formato errado é pior do que não testar, porque dá a impressão de
 * cobertura.
 */
const recusa = (code: string, constraint?: string) =>
  Object.assign(new Error("Failed query: insert into \"projects\" …"), {
    cause: doDriver(code, constraint),
  });

describe("tradução do erro do banco", () => {
  it("nome de projeto repetido aponta para o campo do nome", () => {
    const { campo, mensagem } = traduzirErroDeBanco(
      recusa("23505", "projects_user_name_unq"),
    );
    expect(campo).toBe("name");
    expect(mensagem).toContain("já tem um projeto com esse nome");
  });

  it("adotar a mesma entrada do catálogo duas vezes tem mensagem própria", () => {
    const { campo, mensagem } = traduzirErroDeBanco(
      recusa("23505", "projects_user_adopted_unq"),
    );
    expect(campo).toBe("geral");
    expect(mensagem).toContain("já adicionou este projeto");
  });

  it("nome de conta repetido aponta para o campo da conta", () => {
    expect(traduzirErroDeBanco(recusa("23505", "accounts_user_label_unq")).campo).toBe(
      "label",
    );
  });

  it("medição repetida no mesmo dia aponta para a data", () => {
    expect(traduzirErroDeBanco(recusa("23505", "points_pair_day_unq")).campo).toBe(
      "takenAt",
    );
  });

  it("constraint desconhecida ainda diz que é repetição", () => {
    const { campo, mensagem } = traduzirErroDeBanco(recusa("23505", "tabela_nova_unq"));
    expect(campo).toBe("geral");
    expect(mensagem).toContain("Já existe um registro igual");
  });

  it("erro sem código conhecido continua genérico", () => {
    expect(traduzirErroDeBanco(recusa("XX000")).mensagem).toBe(MENSAGEM_GENERICA);
  });

  it("o que não é objeto não quebra a tradução", () => {
    for (const entrada of [null, undefined, "falhou", 42]) {
      expect(traduzirErroDeBanco(entrada).mensagem).toBe(MENSAGEM_GENERICA);
    }
  });

  it("também entende o erro cru do driver, sem embrulho", () => {
    expect(traduzirErroDeBanco(doDriver("23505", "projects_user_name_unq")).campo).toBe(
      "name",
    );
  });

  it("acha o erro mesmo com mais de uma camada de embrulho", () => {
    const fundo = doDriver("23505", "accounts_user_label_unq");
    const meio = Object.assign(new Error("camada intermediária"), { cause: fundo });
    const topo = Object.assign(new Error("Failed query"), { cause: meio });
    expect(traduzirErroDeBanco(topo).campo).toBe("label");
  });

  it("cadeia circular de causas não trava", () => {
    const a: { cause?: unknown } = {};
    const b = { cause: a };
    a.cause = b;
    expect(traduzirErroDeBanco(a).mensagem).toBe(MENSAGEM_GENERICA);
  });

  /*
   * O teste que justifica o módulo existir. A mensagem genérica existia para
   * não vazar interno do banco, e traduzir só vale se essa garantia continuar
   * de pé: nenhuma frase pode conter nome de tabela, de constraint, valor que
   * colidiu ou id de usuário.
   */
  it("nenhuma mensagem repassa texto do banco", () => {
    const constraints = [
      "projects_user_name_unq",
      "projects_user_slug_unq",
      "accounts_user_label_unq",
      "points_pair_day_unq",
      "occurrences_task_account_date_unq",
      "transactions_user_dedupe_unq",
      "users_email_unique",
      "constraint_que_nao_existe",
    ];
    const codigos = ["23505", "23503", "23502", "23514", "22P02", "22003", "XX000"];

    const vazamentos = ["Key (", "8b94168d", "projects", "_unq", "NeonDbError", "23505"];

    for (const constraint of constraints) {
      for (const code of codigos) {
        const { mensagem } = traduzirErroDeBanco(recusa(code, constraint));
        for (const vazamento of vazamentos) {
          expect(mensagem).not.toContain(vazamento);
        }
      }
    }
  });
});
