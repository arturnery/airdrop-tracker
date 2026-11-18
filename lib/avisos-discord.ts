import { formatDateBr } from "./dates";
import type { IsoDate } from "./types";

/**
 * A mensagem que um aviso publicado gera no canal do Discord (ARCHITECTURE
 * §24), no formato de webhook: um "embed" com o título, o resumo, os pontos
 * principais e o que fazer.
 *
 * Como nos sinais (`lib/sinais-discord.ts`), `allowed_mentions` vazio: o
 * aviso é texto livre, e um "@everyone" colado do anúncio faria o Discord
 * notificar o servidor inteiro. Com as menções desligadas, ele vira texto.
 *
 * O link do site vai no título: a mensagem resume, o mural tem o aviso
 * completo e o botão de compartilhar no X.
 */

export type AvisoParaDiscord = {
  titulo: string;
  resumo: string;
  acao: string | null;
  prazo: IsoDate | null;
  link: string | null;
  projeto: string | null;
  destaques: string | null;
  alerta: string | null;
  postOficialX: string | null;
  /** ISO 8601 */
  publicadoEm: string;
};

/** Azul da marca: o mesmo do botão de entrar no e-mail de aprovação. */
const COR = 0x2563eb;

/** Corta no limite do Discord sem deixar a mensagem ser recusada inteira. */
const caber = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function montarMensagemAvisoDiscord(aviso: AvisoParaDiscord, siteUrl: string | null) {
  const destaques = (aviso.destaques ?? "")
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `-> ${d}`)
    .join("\n");

  const descricao = [aviso.resumo.trim(), destaques].filter(Boolean).join("\n\n");

  const campos = [
    ...(aviso.alerta ? [{ name: "⚠️ Atenção", value: caber(aviso.alerta, 1024), inline: false }] : []),
    ...(aviso.acao ? [{ name: "O que fazer", value: caber(aviso.acao, 1024), inline: false }] : []),
    ...(aviso.prazo ? [{ name: "Prazo", value: formatDateBr(aviso.prazo), inline: true }] : []),
    ...(aviso.link ? [{ name: "Link oficial", value: caber(aviso.link, 1024), inline: true }] : []),
    ...(aviso.postOficialX ? [{ name: "Post oficial no X", value: caber(aviso.postOficialX, 1024), inline: false }] : []),
  ];

  return {
    username: "Avisos Level Cripto",
    content: aviso.projeto ? caber(`Novo aviso: ${aviso.projeto} 🪂`, 2000) : "Novo aviso 🪂",
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: caber(aviso.titulo, 256),
        ...(siteUrl ? { url: `${siteUrl}/avisos` } : {}),
        color: COR,
        description: caber(descricao, 4000),
        fields: campos,
        footer: { text: "Confira sempre o link oficial antes de conectar a carteira." },
        timestamp: aviso.publicadoEm,
      },
    ],
  };
}
