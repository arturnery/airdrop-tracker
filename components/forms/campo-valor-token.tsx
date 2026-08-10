"use client";

import { useState } from "react";

import { CampoTexto } from "@/components/forms/fields";
import { CampoValor } from "@/components/forms/campo-valor";
import { formatUsd, parseUserInput, cents } from "@/lib/money";

/**
 * Valor do lançamento, com aporte em token opcional.
 *
 * Os três campos ficam juntos porque só fazem sentido em conjunto: valor em
 * dólar dividido pela quantidade é o preço unitário de entrada. Esse preço não
 * é digitado nem guardado: é derivado, e aparece enquanto se digita para que
 * um erro de dedo (2 SOL a $100 quando se queria 0,2) salte à vista antes de
 * virar registro.
 */
export function CampoValorToken({
  erros,
  valorInicial = "",
  simboloInicial = "",
  quantidadeInicial = "",
}: {
  erros: Record<string, string>;
  valorInicial?: string;
  simboloInicial?: string;
  quantidadeInicial?: string;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [simbolo, setSimbolo] = useState(simboloInicial);
  const [quantidade, setQuantidade] = useState(quantidadeInicial);

  const parsed = parseUserInput(valor);
  const qtd = Number(quantidade.replace(",", "."));
  const podeCalcular =
    parsed.ok && Number.isFinite(qtd) && qtd > 0 && quantidade.trim() !== "";

  const precoUnitario = podeCalcular
    ? formatUsd(cents(Math.round(Math.abs(parsed.value) / qtd)))
    : null;

  return (
    <>
      <CampoValor
        label="Valor em dólar"
        name="amount"
        obrigatorio
        valor={valor}
        aoMudar={setValor}
        erro={erros.amount}
        ajuda="Informe só a quantia: o sinal vem do tipo do lançamento."
        placeholder="100.00"
      />

      <fieldset className="border-border rounded-md border p-3">
        <legend className="text-muted-foreground px-1 text-xs">
          Foi em token? (opcional)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            label="Token"
            name="tokenSymbol"
            value={simbolo}
            onChange={(evento) => setSimbolo(evento.target.value)}
            erro={erros.tokenSymbol}
            placeholder="SOL"
          />
          <CampoTexto
            label="Quantidade"
            name="tokenAmount"
            value={quantidade}
            onChange={(evento) => setQuantidade(evento.target.value)}
            erro={erros.tokenAmount}
            placeholder="2"
            inputMode="decimal"
          />
        </div>

        {precoUnitario ? (
          <p
            className="border-border text-muted-foreground mt-3 border-t pt-2 text-xs"
            aria-live="polite"
          >
            Preço de entrada:{" "}
            <strong className="text-foreground font-medium">
              {precoUnitario}
            </strong>{" "}
            por {simbolo.trim().toUpperCase() || "token"}
          </p>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Preencha token e quantidade e o preço de entrada aparece aqui. A posição
            é revalorizada pela cotação atual.
          </p>
        )}
      </fieldset>
    </>
  );
}
