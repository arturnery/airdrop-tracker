import { formatarPreco, riscoRetorno, type Sinal } from "./sinais";

/**
 * A mensagem que um sinal publicado gera no canal do Discord, no formato de
 * webhook (um "embed" com os campos da operação).
 *
 * `allowed_mentions` vazio é a parte que importa: a observação é texto livre,
 * e um "@everyone" escrito nela faria o Discord notificar o servidor inteiro.
 * Com as menções desligadas, ele aparece como texto.
 *
 * As cores de long e short são as do próprio Discord e de qualquer gráfico,
 * verde e vermelha: lá fora não vale a regra do site, onde essas cores são
 * só de lucro e prejuízo.
 */
export function montarMensagemDiscord(sinal: Sinal, siteUrl: string | null) {
  const compra = sinal.direcao === "compra";
  const entrada = sinal.entradaAte
    ? `${formatarPreco(sinal.entrada)} a ${formatarPreco(sinal.entradaAte)}`
    : formatarPreco(sinal.entrada);

  const alvos = sinal.alvos
    .map((alvo, i) => {
      const rr = riscoRetorno(sinal, alvo);
      return `TP${i + 1}: ${formatarPreco(alvo)}${rr !== null ? ` (1:${rr.toFixed(1)})` : ""}`;
    })
    .join("\n");

  const campos = [
    { name: sinal.entradaAte ? "Zona de entrada" : "Entrada", value: entrada, inline: true },
    { name: "Stop", value: formatarPreco(sinal.stop), inline: true },
    ...(sinal.timeframe ? [{ name: "Timeframe", value: sinal.timeframe, inline: true }] : []),
    { name: "Alvos", value: alvos, inline: false },
  ];

  return {
    username: "Sinais de trade",
    content: `Novo sinal: ${compra ? "COMPRA" : "VENDA"} ${sinal.ativo}`,
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: `${compra ? "COMPRA (long)" : "VENDA (short)"} ${sinal.ativo}`.slice(0, 256),
        ...(siteUrl ? { url: `${siteUrl}/trade/sinais` } : {}),
        color: compra ? 0x26a69a : 0xef5350,
        ...(sinal.observacao ? { description: sinal.observacao.slice(0, 1000) } : {}),
        fields: campos,
        footer: { text: "Confira a operação antes de entrar." },
        timestamp: sinal.publicadoEm,
      },
    ],
  };
}
