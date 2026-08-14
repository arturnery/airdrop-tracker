/**
 * Traduz a recusa do banco para uma frase que diz o que fazer.
 *
 * O `catch` das ações devolvia sempre "Não foi possível salvar. Tente de novo."
 * A frase é segura e é quase inútil: quem cadastrava um projeto com nome
 * repetido tentava de novo, dava igual, e não tinha como descobrir que o
 * problema era o nome. "Tente de novo" só ajuda quando tentar de novo funciona.
 *
 * O que **não** muda é o motivo de a mensagem genérica existir: o erro do
 * Postgres traz nome de tabela, de constraint e o valor que colidiu, e nada
 * disso pode chegar ao navegador. Por isso aqui não se repassa texto do banco.
 * Cada regra conhecida vira uma frase escrita à mão, e o que não está na lista
 * continua genérico.
 *
 * O par `campo` importa tanto quanto o texto: devolvido com o nome do campo, o
 * erro aparece embaixo dele, e não num aviso solto no rodapé do formulário.
 */

/** O suficiente do erro do Postgres para decidir. Ver `pg` e `NeonDbError`. */
type ErroDeBanco = {
  code?: string;
  constraint?: string;
  cause?: unknown;
};

export type ErroTraduzido = { campo: string; mensagem: string };

export const MENSAGEM_GENERICA = "Não foi possível salvar. Tente de novo.";

/**
 * Regras únicas do schema, uma a uma.
 *
 * A chave é o nome da constraint no Postgres, que é estável: ele está escrito
 * em `db/schema.ts` e muda junto com uma migração, nunca sozinho. Depender do
 * texto da mensagem, que muda com a versão do banco e com o idioma dele, seria
 * a alternativa frágil.
 */
const PorConstraint: Record<string, ErroTraduzido> = {
  projects_user_name_unq: {
    campo: "name",
    mensagem:
      "Você já tem um projeto com esse nome. Use outro, ou abra o que já existe.",
  },
  projects_user_slug_unq: {
    campo: "name",
    mensagem: "Esse nome colide com o endereço de outro projeto seu. Tente uma variação.",
  },
  accounts_user_label_unq: {
    campo: "label",
    mensagem:
      "Você já tem uma conta com esse nome. Os nomes precisam ser distintos para dar " +
      "para saber qual é qual nos lançamentos.",
  },
  points_pair_day_unq: {
    campo: "takenAt",
    mensagem:
      "Já existe uma medição dessa conta neste dia. Apague a anterior, ou registre " +
      "em outra data.",
  },
  occurrences_task_account_date_unq: {
    campo: "geral",
    mensagem:
      "Essa alteração faria duas ocorrências da tarefa caírem no mesmo dia, para a " +
      "mesma conta. Ajuste a data ou a recorrência.",
  },
  transactions_user_dedupe_unq: {
    campo: "geral",
    mensagem:
      "Esse lançamento já foi importado antes. Ele não foi duplicado de propósito.",
  },
  users_email_unique: {
    campo: "email",
    mensagem: "Esse e-mail já tem conta.",
  },
};

/** Códigos do Postgres que dizem o tipo de recusa. */
const VIOLACAO_UNICA = "23505";
const VIOLACAO_CHAVE_ESTRANGEIRA = "23503";
const VIOLACAO_NAO_NULO = "23502";
const VIOLACAO_CHECK = "23514";
const TEXTO_INVALIDO = "22P02";
const NUMERO_FORA_DA_FAIXA = "22003";

/**
 * Procura o erro do Postgres dentro do que chegou.
 *
 * O Drizzle não repassa o erro do driver: ele lança um `Error("Failed query: …")`
 * e pendura o original em `cause`. Quem faz `erro.code` no que o `catch`
 * recebeu encontra `undefined`, e a tradução cai calada no genérico.
 *
 * Foi assim que este módulo nasceu quebrado. Os testes usavam o formato do
 * driver cru, passavam, e a tela continuava dizendo "tente de novo": o teste
 * confirmava a tradução, não o caminho até ela. Percorrer a cadeia resolve, e
 * também aguenta uma camada a mais aparecer amanhã.
 */
function acharErroDoPostgres(erro: unknown): ErroDeBanco | null {
  let atual = erro;
  // O limite existe só para `cause` circular não travar o processo.
  for (let nivel = 0; nivel < 5; nivel += 1) {
    if (typeof atual !== "object" || atual === null) return null;
    const candidato = atual as ErroDeBanco;
    if (candidato.code || candidato.constraint) return candidato;
    atual = candidato.cause;
  }
  return null;
}

export function traduzirErroDeBanco(erro: unknown): ErroTraduzido {
  const generico = { campo: "geral", mensagem: MENSAGEM_GENERICA };

  const doBanco = acharErroDoPostgres(erro);
  if (!doBanco) return generico;

  const { code, constraint } = doBanco;

  if (constraint && PorConstraint[constraint]) return PorConstraint[constraint];

  switch (code) {
    case VIOLACAO_UNICA:
      /* Constraint única fora da lista: dá para dizer o tipo do problema sem
         nomear a regra, que é mais útil do que "tente de novo" e não vaza nada. */
      return {
        campo: "geral",
        mensagem: "Já existe um registro igual a esse. Confira se não é repetido.",
      };

    case VIOLACAO_CHAVE_ESTRANGEIRA:
      return {
        campo: "geral",
        mensagem:
          "Isso aponta para algo que não existe mais, provavelmente apagado em outra " +
          "aba. Recarregue a página e tente de novo.",
      };

    case VIOLACAO_NAO_NULO:
      return {
        campo: "geral",
        mensagem: "Faltou preencher um campo obrigatório.",
      };

    case VIOLACAO_CHECK:
      return {
        campo: "geral",
        mensagem: "Algum valor está fora do que o sistema aceita. Confira os números.",
      };

    case TEXTO_INVALIDO:
      return {
        campo: "geral",
        mensagem: "Algum campo veio num formato que não dá para ler. Confira os números e as datas.",
      };

    case NUMERO_FORA_DA_FAIXA:
      return {
        campo: "geral",
        mensagem: "Um dos números é grande demais para o campo. Confira as casas decimais.",
      };

    default:
      return generico;
  }
}
