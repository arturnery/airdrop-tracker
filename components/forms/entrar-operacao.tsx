"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

import { CampoValor } from "@/components/forms/campo-valor";
import { Formulario } from "@/components/forms/dialogs";
import { useDados } from "@/components/data-provider";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { fromDbNumeric } from "@/lib/money";
import type { Sinal } from "@/lib/sinais";
import { entradaTradeSchema, erros } from "@/lib/validators";

/**
 * Entrar numa operação aberta, com o valor em dólar. Quem já entrou vê com
 * quanto, e pode corrigir o valor ou sair enquanto a operação estiver aberta.
 * O resultado em dólar aparece quando ela fechar, em Resultados.
 */
export function EntrarNaOperacao({ sinal }: { sinal: Sinal }) {
  const { acoes, salvando } = useDados();
  const [valor, setValor] = useState(sinal.minhaEntradaUsd ? String(Number(sinal.minhaEntradaUsd)) : "");
  const [erroSair, setErroSair] = useState<string | null>(null);
  const jaEntrou = Boolean(sinal.minhaEntradaUsd);

  const dialogo = (
    <Formulario
      titulo={`${jaEntrou ? "Alterar entrada" : "Entrar"} em ${sinal.ativo}`}
      descricao="Com quanto você entrou nesta operação, em dólar. Quando ela fechar, o seu resultado em dólar aparece em Resultados."
      gatilho={
        jaEntrou ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs">
            Alterar
          </Button>
        ) : (
          <Button type="button" size="sm" className="h-8 w-full gap-1.5">
            <LogIn className="size-3.5" aria-hidden="true" />
            Entrar na operação
          </Button>
        )
      }
      rotuloEnvio={jaEntrou ? "Salvar" : "Entrar"}
      aoEnviar={() => {
        const bruto = { sinalId: sinal.id, valor };
        const validado = entradaTradeSchema.safeParse(bruto);
        if (!validado.success) return erros(validado);
        return acoes.entrarNaOperacao(bruto);
      }}
    >
      {({ erros: e }) => (
        <CampoValor
          label="Valor de entrada (US$)"
          name="valor"
          obrigatorio
          valor={valor}
          aoMudar={setValor}
          erro={e.valor ?? e.geral}
          placeholder="200"
          autoFocus
        />
      )}
    </Formulario>
  );

  if (!jaEntrou) return <div className="mt-3">{dialogo}</div>;

  return (
    <div className="border-border bg-secondary/40 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span>
        Você entrou com{" "}
        <strong className="font-semibold">
          <Money value={fromDbNumeric(sinal.minhaEntradaUsd!)} />
        </strong>
      </span>
      <span className="flex items-center gap-1">
        {dialogo}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-7 px-2 text-xs"
          disabled={salvando}
          onClick={async () => {
            setErroSair(null);
            const falha = await acoes.sairDaOperacao(sinal.id);
            if (falha) setErroSair(Object.values(falha)[0] ?? "Não foi possível sair.");
            else setValor("");
          }}
        >
          Sair
        </Button>
      </span>
      {erroSair ? (
        <p role="alert" className="text-negative w-full text-xs">
          {erroSair}
        </p>
      ) : null}
    </div>
  );
}
