/**
 * Aritmética de pontos.
 *
 * Separado de `money.ts` de propósito, e não por duplicação:
 *
 *  - **Unidade diferente por projeto.** Ponto de um projeto e de outro não
 *    são a mesma coisa; somá-los não significa nada. Só existe soma DENTRO de
 *    um projeto. Não há nada equivalente a "total de pontos da carteira".
 *  - **Escala diferente.** Dinheiro tem 2 casas; programas de pontos costumam
 *    usar até 4 e valores muito maiores.
 *  - **Não é caixa.** Ponto nunca entra em aporte, exposição, P&L ou ROI.
 *
 * Como em `money.ts`, o valor trafega como string (o formato que o `numeric` do
 * Postgres devolve) e as contas acontecem em inteiro escalado.
 */

declare const pointsBrand: unique symbol;

/** Pontos em milésimos de milésimo — inteiro escalado por 10⁴. */
export type Points = number & { readonly [pointsBrand]: true };

const ESCALA = 10_000;
const CASAS = 4;

export class PointsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PointsError";
  }
}

export function points(value: number): Points {
  if (!Number.isInteger(value)) {
    throw new PointsError(`Pontos escalados precisam ser inteiros: ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new PointsError(`Valor fora do intervalo seguro: ${value}`);
  }
  return value as Points;
}

export const ZERO_PONTOS = points(0);

/** Converte o `numeric` do banco para pontos escalados. */
export function fromDbPoints(value: string | null | undefined): Points {
  if (value === null || value === undefined || value === "") return ZERO_PONTOS;

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) {
    throw new PointsError(`Valor de pontos inválido vindo do banco: "${value}"`);
  }
  const [, sinal, inteiro, frac = ""] = match;
  const decimais = (frac + "0".repeat(CASAS)).slice(0, CASAS);
  const total = Number(inteiro) * ESCALA + Number(decimais);

  if (!Number.isSafeInteger(total)) {
    throw new PointsError(`Valor de pontos excede o intervalo: "${value}"`);
  }
  return points(sinal === "-" ? -total : total);
}

/** Converte pontos escalados para o formato do banco, sem passar por float. */
export function toDbPoints(value: Points): string {
  const negativo = value < 0;
  const abs = Math.abs(value);
  const inteiro = Math.floor(abs / ESCALA);
  const frac = String(abs % ESCALA).padStart(CASAS, "0");
  return `${negativo ? "-" : ""}${inteiro}.${frac}`;
}

export type ParsePointsResult =
  | { ok: true; value: Points }
  | { ok: false; error: string };

/**
 * Interpreta o que o usuário digitou.
 *
 * Programas de pontos exibem números com separador de milhar ("12.450",
 * "1,250,000"), então os separadores são descartados e só o último grupo curto
 * é tratado como decimal.
 */
export function parsePointsInput(raw: string): ParsePointsResult {
  const limpo = raw.trim().replace(/\s|pts?\.?/gi, "");
  if (limpo === "") return { ok: false, error: "Informe a quantidade de pontos." };

  const negativo = limpo.startsWith("-");
  const corpo = limpo.replace(/^[-+]/, "");

  if (!/^[\d.,]+$/.test(corpo)) {
    return { ok: false, error: `Valor inválido: "${raw}"` };
  }

  const ultimoPonto = corpo.lastIndexOf(".");
  const ultimaVirgula = corpo.lastIndexOf(",");
  const ultimoSep = Math.max(ultimoPonto, ultimaVirgula);

  let inteiro = corpo;
  let decimal = "";

  if (ultimoSep !== -1) {
    const depois = corpo.length - ultimoSep - 1;
    // 3 dígitos após o último separador é agrupamento de milhar, não decimal.
    if (depois !== 3) {
      inteiro = corpo.slice(0, ultimoSep);
      decimal = corpo.slice(ultimoSep + 1);
    }
  }

  if (/[.,]/.test(decimal)) {
    return { ok: false, error: `Valor inválido: "${raw}"` };
  }
  // A parte inteira ou não tem separador, ou é agrupamento de milhar exato,
  // com um único tipo de separador. Sem isso, "1.5,5" passaria como 15,5.
  if (/[.,]/.test(inteiro)) {
    const temPonto = inteiro.includes(".");
    const temVirgula = inteiro.includes(",");
    const agrupado = temPonto
      ? /^\d{1,3}(?:\.\d{3})+$/.test(inteiro)
      : /^\d{1,3}(?:,\d{3})+$/.test(inteiro);
    if ((temPonto && temVirgula) || !agrupado) {
      return { ok: false, error: `Valor inválido: "${raw}"` };
    }
  }
  inteiro = inteiro.replace(/[.,]/g, "");
  if (decimal.length > CASAS) {
    return { ok: false, error: `Use no máximo ${CASAS} casas decimais.` };
  }
  if (inteiro === "" && decimal === "") {
    return { ok: false, error: `Valor inválido: "${raw}"` };
  }

  const decimais = (decimal + "0".repeat(CASAS)).slice(0, CASAS);
  const total = Number(inteiro || "0") * ESCALA + Number(decimais);

  if (!Number.isSafeInteger(total)) {
    return { ok: false, error: "Valor grande demais." };
  }
  return { ok: true, value: points(negativo ? -total : total) };
}

/** Formata para exibição: 124500000 -> "12.450". Casas decimais só se houver. */
export function formatPoints(value: Points): string {
  const inteiro = value / ESCALA;
  const temFracao = Math.abs(value % ESCALA) > 0;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: temFracao ? 2 : 0,
  }).format(inteiro);
}

/** Formata com sinal explícito, para variações. */
export function formatPointsDelta(value: Points): string {
  const texto = formatPoints(points(Math.abs(value)));
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${texto}`;
}

export function addPoints(...values: Points[]): Points {
  return points(values.reduce<number>((acc, v) => acc + v, 0));
}

export function subtractPoints(a: Points, b: Points): Points {
  return points(a - b);
}

/** Variação percentual entre dois totais. `null` quando não havia base. */
export function percentGrowth(atual: Points, anterior: Points): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}
