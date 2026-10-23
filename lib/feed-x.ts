import { perfilDoX } from "./compartilhar-x";
import type { ProjectStatus } from "./types";

/**
 * Feed do X dos projetos da comunidade (ARCHITECTURE §26).
 *
 * O caminho é o grátis: quem administra mantém uma Lista pública no X com
 * os perfis dos projetos, e o site mostra essa Lista pelo embed oficial do
 * X. Ler posts pela API do X é pago. O embed tem um limite conhecido: o X
 * só mostra o feed para quem está logado no X naquele navegador; para os
 * outros, aparece "Rate limit exceeded". Por isso a página sempre traz
 * também os perfis de cada projeto, com link direto.
 */

/** Status que saem do feed: o projeto já acabou para quem farma. */
const FORA_DO_FEED: ProjectStatus[] = ["distribuido", "descartado"];

/**
 * O link canônico de uma Lista do X (`https://x.com/i/lists/<id>`), aceitando
 * x.com ou twitter.com, com ou sem parâmetros. `null` se não for uma Lista.
 */
export function linkDaListaX(url: string | null | undefined): string | null {
  const id = url?.trim().match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/i\/lists\/(\d{5,25})(?:[/?#].*)?$/i)?.[1];
  return id ? `https://x.com/i/lists/${id}` : null;
}

export type ProjetoNoX = { nome: string; perfil: string | null; status: ProjectStatus };

/**
 * Os projetos do feed: os destaques, menos distribuídos e descartados, com o
 * @ lido do endereço do X cadastrado. Quem tem @ vem primeiro, em ordem de
 * nome; quem não tem vem depois, para quem administra completar.
 */
export function projetosDoFeed(destaques: { nome: string; twitterUrl: string | null; status: ProjectStatus }[]): ProjetoNoX[] {
  return destaques
    .filter((d) => !FORA_DO_FEED.includes(d.status))
    .map((d) => ({ nome: d.nome, perfil: perfilDoX(d.twitterUrl), status: d.status }))
    .sort((a, b) => Number(!a.perfil) - Number(!b.perfil) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Os @ prontos para colar (um por linha), na hora de montar a Lista no X. */
export const arrobasParaCopiar = (projetos: ProjetoNoX[]) =>
  projetos.flatMap((p) => (p.perfil ? [`@${p.perfil}`] : [])).join("\n");
