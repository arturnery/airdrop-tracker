import { PageHeader } from "@/components/page-header";
import { changelog, rotulos } from "@/lib/changelog";
import { formatDateBr } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * O que mudou a cada atualização.
 *
 * Fica no rodapé e não no menu porque é consulta ocasional: o menu é para o
 * que se faz todo dia, e disputar espaço ali atrapalharia o uso.
 */
const cores: Record<string, string> = {
  novidade: "border-positive/40 bg-positive/10 text-positive",
  correcao: "border-negative/40 bg-negative/10 text-negative",
  melhoria: "border-border bg-secondary text-muted-foreground",
};

export default function NovidadesPage() {
  return (
    <>
      <PageHeader
        title="Novidades"
        description="O que mudou a cada atualização, da mais recente para a mais antiga."
      />

      <ol className="space-y-10">
        {changelog.map((versao) => (
          <li key={versao.versao}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-base font-medium">Versão {versao.versao}</h2>
              <time
                dateTime={versao.data}
                className="text-muted-foreground text-xs"
              >
                {formatDateBr(versao.data)}
              </time>
            </div>

            <ul className="space-y-3">
              {versao.mudancas.map((mudanca, i) => (
                <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs whitespace-nowrap",
                      cores[mudanca.tipo],
                    )}
                  >
                    {rotulos[mudanca.tipo]}
                  </span>
                  <span className="min-w-60 flex-1 text-sm leading-relaxed">
                    {mudanca.texto}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}
