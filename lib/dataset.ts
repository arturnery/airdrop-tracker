import type {
  RawAccount,
  RawAirdropClaim,
  RawBalanceSnapshot,
  RawGoal,
  RawProject,
  RawProjectAccount,
  RawTask,
  RawTaskOccurrence,
  RawTransaction,
} from "@/db/queries/fixtures";

/**
 * Conjunto completo de linhas do domínio, no formato que o banco devolve.
 *
 * Existe para que a agregação (`lib/selectors.ts`) seja função pura de
 * `Dataset` -> view models. O mesmo código serve dois modos:
 *
 *  - **local** (agora): o Dataset vive no navegador, em localStorage, para
 *    exercitar os formulários sem banco;
 *  - **servidor** (fase de backend): o Dataset vem do Drizzle e a agregação
 *    roda no servidor.
 *
 * Como nada em selectors conhece a origem dos dados, trocar de modo não
 * reescreve regra de negócio.
 */
export type Dataset = {
  accounts: RawAccount[];
  projects: RawProject[];
  projectAccounts: RawProjectAccount[];
  transactions: RawTransaction[];
  balanceSnapshots: RawBalanceSnapshot[];
  tasks: RawTask[];
  taskOccurrences: RawTaskOccurrence[];
  goals: RawGoal[];
  airdropClaims: RawAirdropClaim[];
};

export const emptyDataset = (): Dataset => ({
  accounts: [],
  projects: [],
  projectAccounts: [],
  transactions: [],
  balanceSnapshots: [],
  tasks: [],
  taskOccurrences: [],
  goals: [],
  airdropClaims: [],
});

/** Slug a partir do nome: "Ondo Perp" -> "ondo-perp". */
export function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug único dentro do dataset, sufixando quando já existe. */
export function uniqueSlug(nome: string, existentes: string[]): string {
  const base = slugify(nome) || "projeto";
  if (!existentes.includes(base)) return base;
  let n = 2;
  while (existentes.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function novoId(prefixo: string): string {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`;
}
