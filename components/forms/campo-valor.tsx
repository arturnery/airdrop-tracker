"use client";

import { CampoTexto } from "@/components/forms/fields";
import { formatUsd, parseUserInput } from "@/lib/money";
import { formatPoints, parsePointsInput } from "@/lib/points";

/**
 * Campo numérico que mostra como o valor digitado foi entendido.
 *
 * Digitar "10000" num campo cru não diz se aquilo virou dez mil ou cem: sem
 * separador, o olho não confere o número. E os parsers aceitam várias formas
 * ("$20.00", "20,00", "1.234,56"), então a mesma sequência de teclas pode ter
 * mais de uma leitura possível.
 *
 * A solução aqui não é formatar o texto enquanto se digita. Máscara em campo
 * numérico briga com a posição do cursor: quem edita o meio do número acaba
 * com o cursor pulando para o fim. Em vez disso, o campo continua aceitando
 * texto livre e o valor interpretado aparece embaixo, já formatado.
 *
 * Três formatos porque o domínio tem três grandezas que **não se somam entre
 * si**: dinheiro em centavos, pontos em escala própria (§4.4) e quantidade de
 * token, que não é nem uma nem outra. Usar o formatador errado exibiria um
 * número plausível e falso, que é pior que nenhum.
 */
export type FormatoValor = "dinheiro" | "pontos" | "quantidade";

/** Quantidade de token: separador de milhar, casas decimais preservadas. */
function formatarQuantidade(bruto: string): string | null {
  const limpo = bruto.trim().replace(/\s/g, "").replace(",", ".");
  if (limpo === "" || !/^\d+(\.\d+)?$/.test(limpo)) return null;

  const numero = Number(limpo);
  if (!Number.isFinite(numero)) return null;

  // Até 8 casas: quantidade de token costuma ter mais precisão que dinheiro.
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(
    numero,
  );
}

function interpretar(valor: string, formato: FormatoValor): string | null {
  if (valor.trim() === "") return null;

  if (formato === "quantidade") return formatarQuantidade(valor);

  if (formato === "pontos") {
    const analisado = parsePointsInput(valor);
    return analisado.ok ? formatPoints(analisado.value) : null;
  }

  const analisado = parseUserInput(valor);
  return analisado.ok ? formatUsd(analisado.value) : null;
}

export function CampoValor({
  label,
  name,
  valor,
  aoMudar,
  erro,
  ajuda,
  obrigatorio,
  placeholder,
  formato = "dinheiro",
  autoFocus,
}: {
  label: string;
  name: string;
  valor: string;
  aoMudar: (valor: string) => void;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  placeholder?: string;
  formato?: FormatoValor;
  autoFocus?: boolean;
}) {
  // Só ecoa o que já é um número válido: repetir a mensagem de erro do campo
  // logo abaixo dele não ajudaria ninguém.
  const interpretado = interpretar(valor, formato);

  return (
    <div>
      <CampoTexto
        label={label}
        name={name}
        obrigatorio={obrigatorio}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        erro={erro}
        ajuda={ajuda}
        placeholder={placeholder}
        inputMode="decimal"
        autoFocus={autoFocus}
      />
      {interpretado ? (
        <p className="text-muted-foreground mt-1 text-xs" aria-live="polite">
          Vai ser registrado como{" "}
          <strong className="text-foreground tabular font-medium">
            {interpretado}
          </strong>
        </p>
      ) : null}
    </div>
  );
}
