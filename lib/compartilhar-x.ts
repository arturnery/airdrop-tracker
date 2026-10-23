import { daysBetween } from "./dates";
import type { Cents } from "./money";
import { formatPoints, type Points } from "./points";

/**
 * O post que o botão "Compartilhar no X" abre pronto (ARCHITECTURE §23).
 *
 * Não usa a API do X: abre o link de publicação (`/intent/post`) com o texto
 * preenchido, e é a pessoa quem confere e publica, na conta dela. Sem chave,
 * sem custo, e nada sai do sistema sem o clique dela.
 *
 * Puro, para o texto ser testado: o limite de 280 caracteres, o @ do projeto
 * que só entra quando é um perfil de verdade, e o período ("nesta semana" só
 * quando as duas medições têm de fato uma semana entre elas).
 */

export const SITE_DA_COMUNIDADE = "https://www.levelcripto.com.br/";
export const PERFIL_DA_COMUNIDADE = "LevelCripto";

/** O X conta todo link como 23 caracteres, seja qual for o tamanho. */
const TAMANHO_DE_LINK = 23;
export const LIMITE_DO_X = 280;

/** Caminhos de x.com que não são perfil ("x.com/search?q=..." não é um @). */
const NAO_SAO_PERFIL = new Set(["search", "home", "intent", "i", "explore", "hashtag", "share", "settings", "messages", "notifications"]);

/**
 * O @ do projeto a partir do endereço do X (ou Twitter) cadastrado nele.
 * `null` quando o endereço não é um perfil: aí o post usa o nome do projeto.
 */
export function perfilDoX(url: string | null): string | null {
  if (!url) return null;
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }
  const host = endereco.hostname.replace(/^www\./, "").replace(/^mobile\./, "");
  if (host !== "x.com" && host !== "twitter.com") return null;
  const primeiro = endereco.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(primeiro) || NAO_SAO_PERFIL.has(primeiro.toLowerCase())) return null;
  return primeiro;
}

/** "nesta semana", "nos últimos 12 dias", "hoje"; null sem medição anterior. */
export function descreverPeriodo(desde: string | null, ate: string | null): string | null {
  if (!desde || !ate) return null;
  const dias = daysBetween(desde, ate);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "desde ontem";
  if (dias >= 6 && dias <= 8) return "nesta semana";
  return `nos últimos ${dias} dias`;
}

const numero = (valor: number, casas = 0, minimo = 0) =>
  valor.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: minimo });

/** "US$ 5.000" ou "US$ 1.250,50": dinheiro em centavos, sem casas quando redondo. */
export function dolar(valor: Cents): string {
  const reais = Math.abs(valor) / 100;
  return Number.isInteger(reais) ? `US$ ${numero(reais)}` : `US$ ${numero(reais, 2, 2)}`;
}

const pontos = (valor: Points) => formatPoints(valor);

/**
 * Fixo em todo post: de onde vem a ferramenta, e o convite para quem quiser
 * entrar na comunidade, que é o único caminho de acesso a ela.
 */
const rodape = () =>
  `Acompanho meus airdrops pela ferramenta da comunidade Level Cripto Pro (@${PERFIL_DA_COMUNIDADE}).\n` +
  `Quer fazer parte? Entra aqui: ${SITE_DA_COMUNIDADE}`;

/**
 * Como o projeto aparece no post: o @ quando houver, senão o nome. As frases
 * usam "em" e "de", e nunca "na"/"da": o nome do projeto pode ser de qualquer
 * gênero, e o artigo erraria metade das vezes.
 */
const marcar = (projeto: { nome: string; perfil: string | null }) =>
  projeto.perfil ? `@${projeto.perfil}` : projeto.nome;

export type ProjetoDoPost = { nome: string; perfil: string | null };

export function postDeVolume(dados: {
  projeto: ProjetoDoPost;
  total: Cents;
  variacao: Cents | null;
  periodo: string | null;
}): string {
  const p = marcar(dados.projeto);
  const corpo =
    dados.variacao !== null && dados.variacao > 0 && dados.periodo
      ? `📈 +${dolar(dados.variacao)} de volume em ${p} ${dados.periodo}.\nTotal acumulado: ${dolar(dados.total)}.`
      : `📈 Já somo ${dolar(dados.total)} de volume em ${p}.`;
  return `${corpo}\n\n${rodape()}`;
}

export function postDePontos(dados: {
  projeto: ProjetoDoPost;
  rotulo: string;
  total: Points;
  variacao: Points | null;
  periodo: string | null;
}): string {
  const p = marcar(dados.projeto);
  const unidade = dados.rotulo.toLowerCase() === "pontos" ? "pontos" : dados.rotulo;
  const corpo =
    dados.variacao !== null && dados.variacao > 0 && dados.periodo
      ? `🎯 +${pontos(dados.variacao)} ${unidade} em ${p} ${dados.periodo}.\nJá somo ${pontos(dados.total)} ${unidade} no programa.`
      : `🎯 Já somo ${pontos(dados.total)} ${unidade} em ${p}.`;
  return `${corpo}\n\n${rodape()}`;
}

/** Só para resultado positivo: o botão não aparece em projeto no prejuízo. */
export function postDeResultado(dados: {
  projeto: ProjetoDoPost;
  resultado: Cents;
  roi: number | null;
  airdropRecebido: boolean;
}): string {
  const p = marcar(dados.projeto);
  const linha = dados.airdropRecebido
    ? `💰 Airdrop de ${p} no bolso: resultado de +${dolar(dados.resultado)}.`
    : `💰 Resultado de +${dolar(dados.resultado)} farmando ${p}.`;
  const roi = dados.roi !== null && dados.roi > 0 ? `\nROI de ${numero(dados.roi, 1)}% sobre o capital usado.` : "";
  return `${linha}${roi}\n\n${rodape()}`;
}

/**
 * Parte 1 do aviso no X: o anúncio, no formato definido pela comunidade.
 *
 *   Anúncio do airdrop da @extendedapp 🪂
 *
 *   -> 30% do supply será distribuído para a comunidade
 *   -> Data prevista para o mês de NOV
 *   -> Não terá página para claim: será dropado direto na sua wallet, então fiquem atentos a golpes
 *
 *   https://x.com/extendedapp/status/...   ← vira a citação do post oficial
 *
 * Três dados: o que será distribuído, quando, e como chega com o cuidado
 * contra golpe (o alerta vira o último tópico). Com o link do post oficial no
 * fim, o X mostra o post do projeto citado logo abaixo, o que dá a confiança
 * de "veio da fonte"; sem ele, vai o link oficial do anúncio. O título pode
 * ser trocado no formulário; em branco, usa o modelo. Para caber nos 280, os
 * tópicos saem do penúltimo para trás, e o alerta fica.
 */
export function postAnuncioDoAviso(aviso: {
  chamada: string | null;
  projeto: string | null;
  destaques: string[];
  alerta: string | null;
  perfilProjeto: string | null;
  postOficialX: string | null;
  link: string | null;
}): string {
  const quem = aviso.perfilProjeto ? `da @${aviso.perfilProjeto}` : aviso.projeto ? `de ${aviso.projeto}` : "";
  const titulo = `${aviso.chamada?.trim() || `Anúncio do airdrop ${quem}`.trim()} 🪂`;
  const alerta = aviso.alerta?.trim() || "Fiquem atentos a sites e DMs falsos";
  const fim = aviso.postOficialX ?? aviso.link;
  const montar = (topicos: string[]) =>
    [titulo, "", ...[...topicos, alerta].map((t) => `-> ${t}`), ...(fim ? ["", fim] : [])].join("\n");
  const topicos = [...aviso.destaques];
  while (topicos.length > 0 && tamanhoNoX(montar(topicos)) > LIMITE_DO_X) topicos.pop();
  return montar(topicos);
}

/**
 * Parte 2: a resposta logo abaixo do anúncio, com a divulgação da comunidade.
 * Separada de propósito: o anúncio fica limpo, com cara de notícia, e quem se
 * interessou encontra o convite em seguida.
 */
export function postRespostaDaComunidade(): string {
  return (
    "Quer receber avisos assim antes de todo mundo e organizar seus farms de airdrop? 🚀\n\n" +
    `Na comunidade Level Cripto Pro (@${PERFIL_DA_COMUNIDADE}) você tem os avisos importantes, a ferramenta para acompanhar seus projetos e o ranking da galera.\n\n` +
    `Entra aqui: ${SITE_DA_COMUNIDADE}`
  );
}

/** Abre a tela de publicar já como resposta ao post de id `idDoPost`. */
export function linkParaResponder(texto: string, idDoPost: string): string {
  return `${linkParaPostar(texto)}&in_reply_to=${encodeURIComponent(idDoPost)}`;
}

/** Tamanho do post como o X conta: cada link vale 23 caracteres. */
export function tamanhoNoX(texto: string): number {
  const links = texto.match(/https?:\/\/\S+/g) ?? [];
  const semLinks = links.reduce((t, l) => t.replace(l, ""), texto);
  return [...semLinks].length + links.length * TAMANHO_DE_LINK;
}

/** O link que abre a tela de publicar do X com o texto pronto. */
export function linkParaPostar(texto: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(texto)}`;
}
