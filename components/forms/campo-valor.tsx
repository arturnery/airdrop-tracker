"use client";

import { CampoTexto } from "@/components/forms/fields";
import { formatUsd, parseUserInput } from "@/lib/money";

/**
 * Campo de dinheiro que mostra como o valor digitado foi entendido.
 *
 * Digitar "10000" num campo cru não diz se aquilo virou dez mil ou cem: sem
 * separador, o olho não confere o número. E o parser aceita várias formas
 * ("$20.00", "20,00", "1.234,56"), então a mesma sequência de teclas pode ter
 * mais de uma leitura possível.
 *
 * A solução aqui não é formatar o texto enquanto se digita. Máscara em campo
 * numérico briga com a posição do cursor: quem edita o meio do número acaba
 * com o cursor pulando para o fim. Em vez disso, o campo continua aceitando
 * texto livre e o valor interpretado aparece embaixo, já formatado.
 *
 * É o mesmo recurso que o preço de entrada usa em `CampoValorToken`: mostrar o
 * derivado enquanto se digita, para que um erro de dedo salte à vista antes de
 * virar registro.
 */
export function CampoValor({
  label,
  name,
  valor,
  aoMudar,
  erro,
  ajuda,
  obrigatorio,
  placeholder,
}: {
  label: string;
  name: string;
  valor: string;
  aoMudar: (valor: string) => void;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  placeholder?: string;
}) {
  const analisado = parseUserInput(valor);
  // Só ecoa o que já é um número válido: repetir a mensagem de erro do campo
  // logo abaixo dele não ajudaria ninguém.
  const interpretado =
    valor.trim() !== "" && analisado.ok ? formatUsd(analisado.value) : null;

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
      />
      {interpretado ? (
        <p className="text-muted-foreground mt-1 text-xs" aria-live="polite">
          Vai ser registrado como{" "}
          <strong className="text-foreground font-medium tabular">
            {interpretado}
          </strong>
        </p>
      ) : null}
    </div>
  );
}
