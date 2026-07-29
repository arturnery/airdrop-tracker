import Link from "next/link";

import { Money } from "@/components/money";
import type { CapitalPorProjeto } from "@/lib/types";

/**
 * Distribuição do capital aportado por projeto.
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
        <p className="text-sm font-medium">Nenhum aporte registrado.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          O capital por projeto aparece aqui depois do primeiro depósito.
        </p>
      </div>
    );
  }

  const total = data.reduce((acc, item) => acc + item.aportado, 0);
  const maior = Math.max(...data.map((item) => item.aportado));

  return (
    <div className="border-border rounded-lg border p-5">
      <ol className="space-y-4">
        {data.map((item) => {
          const proporcao = maior > 0 ? (item.aportado / maior) * 100 : 0;
          const fatia = total > 0 ? Math.round((item.aportado / total) * 100) : 0;

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
                  <Money value={item.aportado} />
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
        Total aportado{" "}
        <Money value={total as CapitalPorProjeto["aportado"]} className="text-foreground" />{" "}
        em {data.length} projetos.
      </p>
    </div>
  );
}
