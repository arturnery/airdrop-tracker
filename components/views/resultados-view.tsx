"use client";

import { ChartLine } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/page-header";
import { CardSinal } from "@/components/views/sinais-view";
import { formatarPercentual, formatarR, placarDosSinais, type Sinal } from "@/lib/sinais";
import { cn } from "@/lib/utils";

/**
 * Sinais fechados: o placar no topo e os cards embaixo, do fechamento mais
 * recente ao mais antigo. O placar soma o mesmo resultado que cada card
 * mostra (`placarDosSinais`), e os não acionados aparecem na lista mas não
 * contam: um sinal que nunca entrou não acertou nem errou.
 */
export function ResultadosView({ sinais, ehAdmin }: { sinais: Sinal[]; ehAdmin: boolean }) {
  const placar = placarDosSinais(sinais);
  const tom = (valor: number) => (valor > 0 ? "text-positive" : valor < 0 ? "text-negative" : undefined);

  return (
    <>
      <PageHeader
        icon={ChartLine}
        title="Resultados"
        description="Sinais fechados e o placar: quantos deram lucro, quantos deram prejuízo e quanto somaram."
      />

      {sinais.length === 0 ? (
        <EmptyState
          title="Nenhum sinal fechado ainda."
          description="Quando um sinal for fechado em Sinais, ele aparece aqui com o resultado."
        />
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-3 tabular-nums sm:grid-cols-4">
            <Numero rotulo="Fechados" valor={String(placar.fechados)} />
            <Numero
              rotulo="Taxa de acerto"
              valor={
                placar.taxaDeAcerto === null
                  ? "–"
                  : `${placar.taxaDeAcerto.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`
              }
              detalhe={`${placar.lucros} com lucro · ${placar.prejuizos} com prejuízo`}
            />
            <Numero
              rotulo="Soma em R"
              valor={formatarR(placar.somaR)}
              classe={tom(placar.somaR)}
              detalhe="Riscos ganhos menos perdidos"
            />
            <Numero
              rotulo="Soma em %"
              valor={formatarPercentual(placar.somaPercentual)}
              classe={tom(placar.somaPercentual)}
              detalhe="Variação somada, sem alavancagem"
            />
          </dl>

          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sinais.map((sinal) => (
              <li key={sinal.id}>
                <CardSinal sinal={sinal} ehAdmin={ehAdmin} discordConfigurado={false} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
  classe,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  classe?: string;
}) {
  return (
    <div className="bg-card border-border rounded-lg border p-4">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className={cn("mt-1 text-2xl font-semibold tracking-tight", classe)}>{valor}</dd>
      {detalhe ? <dd className="text-muted-foreground mt-0.5 text-xs">{detalhe}</dd> : null}
    </div>
  );
}
