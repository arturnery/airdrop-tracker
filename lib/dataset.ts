import type {
  RawAccount,
  RawAirdropClaim,
  RawCatalogProject,
  RawGoal,
  RawGoalEntry,
  RawPointsSnapshot,
  RawVolumeSnapshot,
  RawTokenPrice,
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
  tasks: RawTask[];
  taskOccurrences: RawTaskOccurrence[];
  goals: RawGoal[];
  goalEntries: RawGoalEntry[];
  tokenPrices: RawTokenPrice[];
  pointsSnapshots: RawPointsSnapshot[];
  volumeSnapshots: RawVolumeSnapshot[];
  airdropClaims: RawAirdropClaim[];
  /** Global, não filtrada por usuário: publicada é visível para todo mundo. */
  catalogProjects: RawCatalogProject[];
};

export const emptyDataset = (): Dataset => ({
  accounts: [],
  projects: [],
  projectAccounts: [],
  transactions: [],
  tasks: [],
  taskOccurrences: [],
  goals: [],
  goalEntries: [],
  tokenPrices: [],
  pointsSnapshots: [],
  volumeSnapshots: [],
  airdropClaims: [],
  catalogProjects: [],
});

/** Slug a partir do nome: "Vertex Perp" -> "vertex-perp". */
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

/**
 * Texto pronto para comparação de busca: sem acento, sem caixa, sem sobra.
 *
 * Separado de `slugify` porque as duas normalizam para fins diferentes.
 * `slugify` produz um identificador de URL e por isso troca espaço por hífen e
 * descarta tudo que não é letra ou número; usá-la na busca faria "Prisma DEX"
 * virar "prisma-dex", e aí digitar "prisma dex" não acharia nada.
 *
 * Aqui só se remove o que atrapalha a comparação. Digitar o acento certo para
 * achar o que já está na tela é exatamente o atrito que uma busca deve tirar.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
