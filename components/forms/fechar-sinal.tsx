"use client";

import { useState } from "react";
import { CircleCheckBig } from "lucide-react";

import { Formulario } from "@/components/forms/dialogs";
import { CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { useDados } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import {
  formatarPercentual,
  formatarPreco,
  formatarR,
  lerPreco,
  precoDaSaida,
  resultadoDoSinal,
  type Fechamento,
  type Sinal,
} from "@/lib/sinais";
import { cn } from "@/lib/utils";
import { erros, fecharSinalSchema } from "@/lib/validators";

/**
 * Fecha um sinal: escolhe por onde ele saiu, e o resultado aparece antes de
 * confirmar, calculado do preço (a mesma conta que a aba de resultados soma).
 * Ninguém digita "lucro" ou "prejuízo": isso sai do preço de saída.
 */
export function FecharSinal({ sinal }: { sinal: Sinal }) {
  const { acoes } = useDados();
  const [fechamento, setFechamento] = useState<Fechamento>("alvo1");
  const [manual, setManual] = useState("");

  const preco =
    fechamento === "cancelado" ? null : precoDaSaida(sinal, fechamento, lerPreco(manual));
  const resultado = preco ? resultadoDoSinal(sinal, preco) : null;

  const opcoes = [
    ...sinal.alvos.map((alvo, i) => ({
      valor: `alvo${i + 1}`,
      rotulo: `Bateu o alvo ${i + 1} (${formatarPreco(alvo)})`,
    })),
    { valor: "stop", rotulo: `Stopou (${formatarPreco(sinal.stop)})` },
    { valor: "manual", rotulo: "Saiu em outro preço" },
    { valor: "cancelado", rotulo: "Não acionou (cancelar)" },
  ];

  return (
    <Formulario
      titulo={`Fechar ${sinal.direcao === "compra" ? "compra" : "venda"} de ${sinal.ativo}`}
      descricao="O sinal sai da lista e vai para Resultados, com o lucro ou prejuízo calculado do preço de saída."
      gatilho={
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
          <CircleCheckBig className="size-3.5" aria-hidden="true" />
          Fechar
        </Button>
      }
      rotuloEnvio={fechamento === "cancelado" ? "Cancelar sinal" : "Fechar sinal"}
      aoEnviar={() => {
        const bruto = { id: sinal.id, fechamento, precoManual: manual };
        const validado = fecharSinalSchema.safeParse(bruto);
        if (!validado.success) return erros(validado);
        return acoes.fecharSinal(bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoSelecao
            label="Como fechou"
            name="fechamento"
            value={fechamento}
            onChange={(ev) => setFechamento(ev.target.value as Fechamento)}
            erro={e.fechamento}
            opcoes={opcoes}
          />
          {fechamento === "manual" ? (
            <CampoTexto
              label="Preço de saída"
              name="precoManual"
              obrigatorio
              value={manual}
              onChange={(ev) => setManual(ev.target.value)}
              erro={e.precoManual}
              inputMode="decimal"
              autoComplete="off"
            />
          ) : null}
          {fechamento === "cancelado" ? (
            <p className="text-muted-foreground text-sm">
              O preço não chegou na entrada. O sinal sai da lista e fica em Resultados como não
              acionado, sem contar no placar.
            </p>
          ) : resultado ? (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-sm tabular-nums",
                resultado.desfecho === "lucro" && "border-positive/40 bg-positive/10 text-positive",
                resultado.desfecho === "prejuizo" && "border-negative/40 bg-negative/10 text-negative",
                resultado.desfecho === "empate" && "border-border text-muted-foreground",
              )}
              aria-live="polite"
            >
              {resultado.desfecho === "lucro" ? "Lucro" : resultado.desfecho === "prejuizo" ? "Prejuízo" : "Empate"}{" "}
              de {formatarPercentual(resultado.percentual)}
              {resultado.r !== null ? ` (${formatarR(resultado.r)})` : ""}, saindo em {formatarPreco(preco!)}
            </p>
          ) : null}
        </>
      )}
    </Formulario>
  );
}
