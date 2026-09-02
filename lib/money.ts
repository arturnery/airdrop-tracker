/**
 * Aritmética monetária em centavos inteiros.
 *
 * Regra do projeto: valor em dinheiro NUNCA vira `number` de ponto flutuante.
 * O Postgres guarda `numeric(18,2)`, o Drizzle devolve string, e aqui a string
 * é convertida para centavos inteiros. Toda conta acontece em inteiro e só a
 * renderização volta para texto.
 *
 * Módulo puro: sem banco, sem React. Ver ARCHITECTURE.md §5.
 */

declare const centsBrand: unique symbol;

/** Valor monetário em centavos. Sempre inteiro, pode ser negativo. */
export type Cents = number & { readonly [centsBrand]: true };

/** Limite seguro: ~90 trilhões de dólares em centavos, bem dentro de MAX_SAFE_INTEGER. */
const MAX_CENTS = Number.MAX_SAFE_INTEGER;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Constrói um Cents a partir de um inteiro já validado. */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`Centavos precisam ser inteiros, recebido: ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Valor fora do intervalo seguro: ${value}`);
  }
  return value as Cents;
}

export const ZERO = cents(0);

/**
 * Converte o `numeric` que o Drizzle devolve como string para centavos.
 * Aceita "20", "20.5", "20.00", "-3.25".
 */
export function fromDbNumeric(value: string | null | undefined): Cents {
  if (value === null || value === undefined || value === "") return ZERO;

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) {
    throw new MoneyError(`Valor numeric inválido vindo do banco: "${value}"`);
  }

  const [, sign, whole, frac = ""] = match;
  // Duas casas exatas: completa com zero ou trunca o excedente.
  const hundredths = (frac + "00").slice(0, 2);
  const total = Number(whole) * 100 + Number(hundredths);

  if (total > MAX_CENTS) {
    throw new MoneyError(`Valor excede o intervalo suportado: "${value}"`);
  }
  return cents(sign === "-" ? -total : total);
}

/**
 * Converte centavos para o formato que o Postgres espera em `numeric(18,2)`.
 * Feito por manipulação de string: divisão por 100 introduziria float.
 */
export function toDbNumeric(value: Cents): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${negative ? "-" : ""}${whole}.${String(frac).padStart(2, "0")}`;
}

export type ParseResult =
  | { ok: true; value: Cents }
  | { ok: false; error: string };

/**
 * Interpreta o que o usuário digitou num formulário.
 *
 * Tolera o que aparece na planilha e o que o teclado brasileiro produz:
 * "$20.00", "20", "1,234.56" (US), "1.234,56" (BR), "-9.00", "(9.00)".
 *
 * Heurística de separador decimal:
 *  - com vírgula E ponto -> o que aparecer por último é o decimal;
 *  - só um separador, com exatamente 3 dígitos depois -> milhar;
 *  - só um separador, com outra quantidade de dígitos -> decimal.
 *
 * Consequência assumida: "10.005" é lido como dez mil e cinco, não como dez
 * com três casas. A ambiguidade é irredutível: "1.234" precisa continuar
 * valendo mil duzentos e trinta e quatro no teclado brasileiro. Milhar exige
 * agrupamento exato de 3 em 3, então "1,23,456" é recusado em vez de aceito
 * torto.
 */
/**
 * Tira os zeros que o Postgres acrescenta, sem tocar no número.
 *
 * Coluna `numeric(36, 18)` devolve `3078.000000000000000000`, e era assim que a
 * quantidade de token aparecia na tabela de recebimentos: um número certo com
 * cara de erro. Num campo de formulário fica pior, porque quem vai corrigir
 * precisa apagar dezoito zeros antes de digitar.
 *
 * Só remove zeros **à direita da vírgula**, e a parte inteira nunca é tocada:
 * `1250.00` vira `1250`, `0.18290000` vira `0.1829`, e `1200` continua `1200`.
 *
 * Vive aqui e não em cada tela porque serve às três grandezas do domínio:
 * dinheiro, pontos e quantidade de token saem todas de colunas `numeric`.
 */
export function semZerosDeSobra(decimal: string): string {
  if (!decimal.includes(".")) return decimal;
  return decimal.replace(/\.?0+$/, "");
}

export function parseUserInput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "Informe um valor." };

  // (9.00) é notação contábil de negativo.
  const parenthesized = /^\((.*)\)$/.exec(trimmed);
  const unwrapped = parenthesized ? `-${parenthesized[1]}` : trimmed;

  const cleaned = unwrapped.replace(/[$\sR]/gi, "");
  const negative = cleaned.startsWith("-");
  const digitsAndSeparators = cleaned.replace(/^[-+]/, "");

  if (!/^[\d.,]+$/.test(digitsAndSeparators)) {
    return { ok: false, error: `Valor inválido: "${raw}"` };
  }

  const lastComma = digitsAndSeparators.lastIndexOf(",");
  const lastDot = digitsAndSeparators.lastIndexOf(".");
  let decimalSep: "," | "." | null = null;

  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    const pos = lastComma !== -1 ? lastComma : lastDot;
    const after = digitsAndSeparators.length - pos - 1;
    const occurrences = digitsAndSeparators.split(sep).length - 1;
    // "1.234" com um separador e 3 dígitos depois é milhar, não decimal.
    decimalSep = occurrences === 1 && after !== 3 ? sep : null;
  }

  /** Milhar só é aceito em grupos exatos de 3: "1.234.567", nunca "1.23.4567". */
  const isGrouped = (text: string, sep: "," | ".") =>
    new RegExp(`^\\d{1,3}(?:\\${sep}\\d{3})+$`).test(text);

  let wholePart: string;
  let fracPart: string;

  if (decimalSep === null) {
    const sep = lastComma !== -1 ? "," : ".";
    const hasSeparator = lastComma !== -1 || lastDot !== -1;
    if (hasSeparator && lastComma !== -1 && lastDot !== -1) {
      return { ok: false, error: `Valor inválido: "${raw}"` };
    }
    if (hasSeparator && !isGrouped(digitsAndSeparators, sep)) {
      return { ok: false, error: `Valor inválido: "${raw}"` };
    }
    wholePart = digitsAndSeparators.replace(/[.,]/g, "");
    fracPart = "";
  } else {
    const idx = digitsAndSeparators.lastIndexOf(decimalSep);
    const wholeRaw = digitsAndSeparators.slice(0, idx);
    fracPart = digitsAndSeparators.slice(idx + 1);

    if (/[.,]/.test(fracPart)) {
      return { ok: false, error: `Valor inválido: "${raw}"` };
    }
    // A parte inteira ou não tem separador, ou tem agrupamento de milhar válido
    // com o outro separador. Isso descarta entradas como "1.2.3,4".
    const thousandSep = decimalSep === "," ? "." : ",";
    const wholeIsValid =
      wholeRaw === "" ||
      /^\d+$/.test(wholeRaw) ||
      isGrouped(wholeRaw, thousandSep);
    if (!wholeIsValid) {
      return { ok: false, error: `Valor inválido: "${raw}"` };
    }
    wholePart = wholeRaw.replace(/[.,]/g, "");
  }

  if (wholePart === "" && fracPart === "") {
    return { ok: false, error: `Valor inválido: "${raw}"` };
  }
  if (fracPart.length > 2) {
    return { ok: false, error: "Use no máximo 2 casas decimais." };
  }

  const hundredths = (fracPart + "00").slice(0, 2);
  const total = Number(wholePart || "0") * 100 + Number(hundredths);

  if (!Number.isSafeInteger(total)) {
    return { ok: false, error: "Valor grande demais." };
  }
  return { ok: true, value: cents(negative ? -total : total) };
}

/** Formata para exibição: 2000 -> "$20.00". */
export function formatUsd(
  value: Cents,
  options: { signDisplay?: "auto" | "always" | "never" } = {},
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: options.signDisplay ?? "auto",
  });
  // Divisão só aqui: Intl arredonda para 2 casas, então o float não escapa.
  return formatter.format(value / 100);
}

/** Formata compacto para cartões de dashboard: 1234500 -> "$12.3k". */
export function formatUsdCompact(value: Cents): string {
  const abs = Math.abs(value);
  if (abs < 1_000_00) return formatUsd(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function addCents(...values: Cents[]): Cents {
  return cents(values.reduce<number>((acc, v) => acc + v, 0));
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function negate(value: Cents): Cents {
  return cents(-value);
}

/** Soma uma coluna `numeric` vinda do banco sem passar por float. */
export function sumDbNumeric(values: (string | null | undefined)[]): Cents {
  return cents(values.reduce<number>((acc, v) => acc + fromDbNumeric(v), 0));
}

/**
 * Percentual com uma casa: valor sobre uma base.
 *
 * Devolve `null` quando não há base positiva, e os dois casos importam:
 *
 * - **Base zero** faria a divisão virar Infinity na tela.
 * - **Base negativa inverteria o sinal**, que é o erro mais grave dos dois:
 *   um lucro de 10 sobre base -10 apareceria como -100%, dizendo o oposto do
 *   que aconteceu. Percentual sobre base negativa não significa nada aqui.
 *
 * Quem chama decide o que mostrar no lugar. Nas telas de resultado, o valor em
 * dólar já diz se foi ganho ou perda sem precisar de percentual.
 */
export function percentOf(value: Cents, base: Cents): number | null {
  if (base <= 0) return null;
  return Math.round((value / base) * 1000) / 10;
}
