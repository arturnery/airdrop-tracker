"use client";

import { useState } from "react";

import { useDados } from "@/components/data-provider";
import { FiltroChips } from "@/components/filtro-chips";
import { LinhaAtividade } from "@/components/historico";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { agruparAtividadePorDia, selectAtividade } from "@/lib/selectors";
import type { TipoAtividade } from "@/lib/types";

const tiposDisponiveis: { valor: TipoAtividade; rotulo: string }[] = [
  { valor: "deposito", rotulo: "Depósitos" },
  { valor: "retirada", rotulo: "Retiradas" },
  { valor: "saldo", rotulo: "Saldos" },
  { valor: "trade", rotulo: "Trades" },
  { valor: "volume", rotulo: "Volume" },
  { valor: "taxa", rotulo: "Taxas" },
  { valor: "recebimento", rotulo: "Airdrops" },
  { valor: "tarefa", rotulo: "Tarefas" },
];

export function HistoricoView() {
  const { dataset, hoje } = useDados();
  const [tipo, setTipo] = useState<TipoAtividade | null>(null);
  const [projeto, setProjeto] = useState<string | null>(null);

  const todas = selectAtividade(dataset);

  const filtradas = todas.filter(
    (a) =>
      (tipo === null || a.tipo === tipo) &&
      (projeto === null || a.projetoSlug === projeto),
  );

  const dias = agruparAtividadePorDia(filtradas);
  const temFiltro = tipo !== null || projeto !== null;

  const projetosComAtividade = [
    ...new Map(todas.map((a) => [a.projetoSlug, a.projetoNome])).entries(),
  ];

  const limparTudo = () => {
    setTipo(null);
    setProjeto(null);
  };

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Tudo que foi feito, do mais recente para o mais antigo."
      />

      {todas.length > 0 ? (
        <div className="border-border mb-8 flex flex-col gap-3 rounded-lg border p-4">
          <FiltroChips
            legenda="Tipo"
            selecionado={tipo}
            aoSelecionar={setTipo}
            opcoes={[
              { valor: null, rotulo: "Tudo", contagem: todas.length },
              ...tiposDisponiveis
                .map((t) => ({
                  valor: t.valor,
                  rotulo: t.rotulo,
                  contagem: todas.filter((a) => a.tipo === t.valor).length,
                }))
                // Não oferece filtro que não devolveria nada.
                .filter((t) => t.contagem > 0),
            ]}
          />
          {projetosComAtividade.length > 1 ? (
            <FiltroChips
              legenda="Projeto"
              selecionado={projeto}
              aoSelecionar={setProjeto}
              opcoes={[
                { valor: null, rotulo: "Todos" },
                ...projetosComAtividade.map(([slug, nome]) => ({
                  valor: slug,
                  rotulo: nome,
                  contagem: todas.filter((a) => a.projetoSlug === slug).length,
                })),
              ]}
            />
          ) : null}
          {temFiltro ? (
            <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-muted-foreground text-xs">
                {filtradas.length} de {todas.length}{" "}
                {todas.length === 1 ? "registro" : "registros"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={limparTudo}
              >
                Limpar filtros
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {todas.length === 0 ? (
        <EmptyState
          title="Nada registrado ainda"
          description="Depósitos, saldos, tarefas concluídas e airdrops recebidos aparecem aqui conforme você registra."
        />
      ) : dias.length === 0 ? (
        <EmptyState
          title="Nenhum registro com esses filtros"
          description="Ajuste o tipo ou o projeto para ver outros registros."
          action={
            <Button variant="outline" size="sm" onClick={limparTudo}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {dias.map((dia) => (
            <section key={dia.data} aria-labelledby={`dia-${dia.data}`}>
              <h2
                id={`dia-${dia.data}`}
                className="mb-3 flex items-baseline gap-2 text-sm font-medium"
              >
                {formatDateBr(dia.data)}
                <span className="text-muted-foreground text-xs font-normal">
                  {relativeLabel(dia.data, hoje)}
                </span>
                <span className="text-muted-foreground tabular text-xs">
                  · {dia.itens.length}
                </span>
              </h2>
              <ul className="border-border divide-border divide-y rounded-lg border">
                {dia.itens.map((item) => (
                  // A data já está no cabeçalho do dia; repetir em cada linha
                  // seria ruído.
                  <LinhaAtividade key={item.id} item={item} hoje={hoje} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
