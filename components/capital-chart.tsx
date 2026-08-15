import Link from "next/link";

import { Money } from "@/components/money";
import type { CapitalPorProjeto } from "@/lib/types";

/**
 * Onde o dinheiro está agora, projeto a projeto.
 *
 * Mostra a **exposição**, não o capital depositado, e a distinção é a razão de
 * a seção existir. "Onde está o capital" é uma pergunta sobre o presente: um
 * projeto onde entraram US$ 202 e restam US$ 20 tem US$ 20 ali, e exibir os 202
 * dizia que havia dez vezes mais dinheiro parado do que há.
 *
 * A versão anterior exibia depósitos menos retiradas, com a justificativa de
 * usar o mesmo número dos cartões. O raciocínio protegia contra bases
 * diferentes na mesma tela e escolheu a base errada: o cartão ao lado se chama
 * "Exposição atual" e é dele que esta lista tem de falar.
 *
 * Projeto com exposição zero ou negativa fica de fora. Zero não ocupa espaço
 * numa lista sobre onde há dinheiro, e negativo não tem barra que o represente:
 * quando aparece, é lançamento faltando, e quem cuida disso é o aviso de
 * consistência (ver `lib/consistencia`).
 *
 * Série única → cor única: a identidade de cada barra vem do rótulo, não da
 * cor. Pintar cada projeto de um tom diferente seria decoração e gastaria a
 * escala categórica sem transmitir nada.
 *
 * O valor aparece como texto ao lado da barra, então a informação nunca depende
 * de enxergar comprimento ou cor. Sem biblioteca de gráfico: CSS resolve, é
 * acessível por construção e não entra no bundle.
 */
export function CapitalPorProjetoChart({ data }: { data: CapitalPorProjeto[] }) {
  if (data.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed px-6 py-10 text-center">
        <p className="text-sm font-medium">Nenhum dinheiro parado em projeto.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          A distribuição aparece aqui assim que houver saldo em algum projeto.
        </p>
      </div>
    );
  }

  const total = data.reduce((acc, item) => acc + item.exposicao, 0);
  const maior = Math.max(...data.map((item) => item.exposicao));

  return (
    <div className="border-border rounded-lg border p-5">
      <ol className="space-y-4">
        {data.map((item) => {
          const proporcao = maior > 0 ? (item.exposicao / maior) * 100 : 0;
          const fatia = total > 0 ? Math.round((item.exposicao / total) * 100) : 0;

          return (
            <li key={item.slug}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <Link
                  href={`/projetos/${item.slug}`}
                  className="focus-visible:ring-ring truncate rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.nome}
                </Link>
                <span className="flex shrink-0 items-baseline gap-2 text-sm">
                  <Money value={item.exposicao} />
                  <span className="text-muted-foreground text-xs tabular">
                    {fatia}%
                  </span>
                </span>
              </div>
              {/* Trilho + preenchimento; pontas arredondadas de 4px. */}
              <div
                className="bg-secondary h-2 overflow-hidden rounded-full"
                role="presentation"
              >
                <div
                  className="bg-chart-1 h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(proporcao, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-muted-foreground border-border mt-5 border-t pt-4 text-xs">
        Exposição total{" "}
        <Money value={total as CapitalPorProjeto["exposicao"]} className="text-foreground" />{" "}
        em {data.length} projetos.
      </p>
    </div>
  );
}
