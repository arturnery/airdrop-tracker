import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { listAccounts } from "@/db/queries/accounts";
import { HOJE } from "@/db/queries/fixtures";
import { formatDateBr, relativeLabel } from "@/lib/dates";
import { cents } from "@/lib/money";

export const metadata = { title: "Contas · airdrop-tracker" };

export default async function ContasPage() {
  const contas = await listAccounts();

  const totalAportado = cents(contas.reduce((acc, c) => acc + c.aportado, 0));
  const totalExposicao = cents(contas.reduce((acc, c) => acc + c.exposicao, 0));
  const contaMaisExposta = contas.reduce(
    (maior, atual) => (atual.exposicao > (maior?.exposicao ?? 0) ? atual : maior),
    contas[0],
  );

  return (
    <>
      <PageHeader
        title="Contas"
        description="Cada carteira ou perfil atravessando todos os projetos — a visão que a planilha não conseguia dar."
      />

      <section aria-label="Indicadores das contas" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Contas cadastradas"
          accent="idle"
          value={<span className="tabular">{contas.length}</span>}
          hint={`${contas.filter((c) => c.ativa).length} ativas`}
        />
        <StatCard
          label="Capital distribuído"
          accent="primary"
          value={<Money value={totalAportado} />}
          hint={<>exposição atual <Money value={totalExposicao} className="text-foreground" /></>}
        />
        <StatCard
          label="Conta mais exposta"
          accent="caution"
          value={
            <span className="text-2xl">{contaMaisExposta?.label ?? "—"}</span>
          }
          hint={
            contaMaisExposta ? (
              <>
                <Money value={contaMaisExposta.exposicao} className="text-foreground" />{" "}
                em {contaMaisExposta.projetos}{" "}
                {contaMaisExposta.projetos === 1 ? "projeto" : "projetos"}
              </>
            ) : undefined
          }
        />
      </section>

      <div className="border-border mt-8 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-160 text-sm">
          <caption className="sr-only">
            Posição consolidada de cada conta
          </caption>
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th scope="col" className="px-4 py-2.5 font-medium">Conta</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Projetos</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Aportado</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Exposição</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Resultado</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Pendências</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Atividade</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {contas.map((conta) => (
              <tr key={conta.id} className="hover:bg-accent/40 transition-colors">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {conta.label}
                  {conta.email ? (
                    <span className="text-muted-foreground block text-xs font-normal">
                      conta de e-mail
                    </span>
                  ) : null}
                </th>
                <td className="text-muted-foreground px-4 py-3 text-right tabular">
                  {conta.projetos}
                </td>
                <td className="px-4 py-3 text-right">
                  <Money value={conta.aportado} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Money value={conta.exposicao} tone="muted" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Money value={conta.resultado} tone="auto" signed />
                </td>
                <td className="px-4 py-3 text-right">
                  {conta.tarefasPendentes > 0 ? (
                    <span className="tabular">{conta.tarefasPendentes}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                  {conta.ultimaAtividade ? (
                    <span title={formatDateBr(conta.ultimaAtividade)}>
                      {relativeLabel(conta.ultimaAtividade, HOJE)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
