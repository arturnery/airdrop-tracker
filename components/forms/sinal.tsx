"use client";

import { useState } from "react";

import { BotaoNovo, Formulario } from "@/components/forms/dialogs";
import { CampoArea, CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { useDados } from "@/components/data-provider";
import { formatarPreco, lerPreco, riscoRetorno } from "@/lib/sinais";
import { erros, sinalSchema } from "@/lib/validators";

/**
 * Publicação de um sinal de trade. Valida com o mesmo `sinalSchema` da
 * Server Action, incluindo a coerência entre direção e preços.
 *
 * Os preços são texto livre ("64.200,50", "0,00000123") e cada campo mostra
 * embaixo como o número foi entendido. O risco/retorno de cada alvo aparece
 * enquanto se digita: um valor absurdo ali é o jeito mais rápido de notar um
 * preço trocado antes de ele chegar à comunidade.
 */

type Erros = Record<string, string>;

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "");

export type ValoresSinal = {
  ativo: string;
  direcao: "compra" | "venda";
  entrada: string;
  entradaAte: string;
  stop: string;
  alvos: [string, string, string, string];
  timeframe: string;
  observacao: string;
};

const VAZIO: ValoresSinal = {
  ativo: "",
  direcao: "compra",
  entrada: "",
  entradaAte: "",
  stop: "",
  alvos: ["", "", "", ""],
  timeframe: "",
  observacao: "",
};

function CampoPreco({
  label,
  name,
  valor,
  aoMudar,
  erro,
  obrigatorio,
  extra,
}: {
  label: string;
  name: string;
  valor: string;
  aoMudar: (v: string) => void;
  erro?: string;
  obrigatorio?: boolean;
  extra?: string | null;
}) {
  const lido = valor.trim() ? lerPreco(valor) : null;
  return (
    <div>
      <CampoTexto
        label={label}
        name={name}
        obrigatorio={obrigatorio}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        erro={erro}
        inputMode="decimal"
        autoComplete="off"
      />
      {lido && !erro ? (
        <p className="text-muted-foreground mt-1 text-xs tabular-nums" aria-live="polite">
          {formatarPreco(lido)}
          {extra ? <span className="text-foreground/80"> · {extra}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function NovoSinal({
  inicial,
  avisos,
  abertoAoMontar = false,
  aoFechar,
}: {
  /** Valores lidos do print pela IA (etapa seguinte). */
  inicial?: Partial<ValoresSinal>;
  avisos?: string[];
  abertoAoMontar?: boolean;
  aoFechar?: () => void;
}) {
  const { acoes } = useDados();
  const [v, setV] = useState<ValoresSinal>({ ...VAZIO, ...inicial });
  const mudar = <K extends keyof ValoresSinal>(campo: K, valor: ValoresSinal[K]) =>
    setV((atual) => ({ ...atual, [campo]: valor }));
  const mudarAlvo = (i: number, valor: string) =>
    setV((atual) => {
      const alvos = [...atual.alvos] as ValoresSinal["alvos"];
      alvos[i] = valor;
      return { ...atual, alvos };
    });

  const entrada = lerPreco(v.entrada);
  const stop = lerPreco(v.stop);
  const rr = (alvo: string) => {
    const lido = lerPreco(alvo);
    if (!entrada || !stop || !lido) return null;
    const r = riscoRetorno({ entrada, entradaAte: lerPreco(v.entradaAte), stop }, lido);
    return r === null ? null : `risco/retorno 1 : ${r.toFixed(1).replace(".", ",")}`;
  };

  return (
    <Formulario
      titulo={inicial ? "Confira o sinal" : "Novo sinal"}
      descricao={
        inicial
          ? "Preenchido pela IA a partir do print. Nada foi publicado ainda: confira cada preço e publique."
          : "Aparece para toda a comunidade na área de trade."
      }
      gatilho={abertoAoMontar ? undefined : <BotaoNovo>Novo sinal</BotaoNovo>}
      abertoAoMontar={abertoAoMontar}
      aoFechar={aoFechar}
      rotuloEnvio="Publicar sinal"
      aoEnviar={(dados) => {
        const bruto = {
          ativo: texto(dados, "ativo"),
          direcao: texto(dados, "direcao"),
          entrada: texto(dados, "entrada"),
          entradaAte: texto(dados, "entradaAte"),
          stop: texto(dados, "stop"),
          alvo1: texto(dados, "alvo1"),
          alvo2: texto(dados, "alvo2"),
          alvo3: texto(dados, "alvo3"),
          alvo4: texto(dados, "alvo4"),
          timeframe: texto(dados, "timeframe"),
          observacao: texto(dados, "observacao"),
        };
        const resultado = sinalSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        // Objeto bruto para o servidor, que valida de novo com o mesmo schema.
        return acoes.publicarSinal(bruto);
      }}
    >
      {({ erros: e }: { erros: Erros }) => (
        <>
          {avisos && avisos.length > 0 ? (
            <ul className="border-caution/40 bg-caution/10 space-y-1 rounded-md border px-3 py-2 text-sm">
              {avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto
              label="Ativo"
              name="ativo"
              obrigatorio
              value={v.ativo}
              onChange={(ev) => mudar("ativo", ev.target.value)}
              erro={e.ativo}
              placeholder="BTC/USDT"
              autoComplete="off"
            />
            <CampoSelecao
              label="Direção"
              name="direcao"
              value={v.direcao}
              onChange={(ev) => mudar("direcao", ev.target.value === "venda" ? "venda" : "compra")}
              erro={e.direcao}
              opcoes={[
                { valor: "compra", rotulo: "Compra (long)" },
                { valor: "venda", rotulo: "Venda (short)" },
              ]}
            />
            <CampoTexto
              label="Timeframe"
              name="timeframe"
              value={v.timeframe}
              onChange={(ev) => mudar("timeframe", ev.target.value)}
              erro={e.timeframe}
              placeholder="4h"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoPreco label="Entrada" name="entrada" obrigatorio valor={v.entrada} aoMudar={(x) => mudar("entrada", x)} erro={e.entrada} />
            <CampoPreco label="Entrada até (zona)" name="entradaAte" valor={v.entradaAte} aoMudar={(x) => mudar("entradaAte", x)} erro={e.entradaAte} />
            <CampoPreco label="Stop" name="stop" obrigatorio valor={v.stop} aoMudar={(x) => mudar("stop", x)} erro={e.stop} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {v.alvos.map((alvo, i) => (
              <CampoPreco
                key={i}
                label={`Alvo ${i + 1}${i === 0 ? "" : " (opcional)"}`}
                name={`alvo${i + 1}`}
                obrigatorio={i === 0}
                valor={alvo}
                aoMudar={(x) => mudarAlvo(i, x)}
                erro={e[`alvo${i + 1}`]}
                extra={rr(alvo)}
              />
            ))}
          </div>
          <CampoArea
            label="Observação"
            name="observacao"
            value={v.observacao}
            onChange={(ev) => mudar("observacao", ev.target.value)}
            erro={e.observacao}
            placeholder="Contexto da operação, gestão, parciais…"
          />
        </>
      )}
    </Formulario>
  );
}
