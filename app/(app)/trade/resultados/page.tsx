import { ResultadosView } from "@/components/views/resultados-view";
import { listarSinais } from "@/db/queries/trade";
import { exigirSessao } from "@/lib/auth";

/** Sinais fechados da área de trade, com o placar. Todos que entram leem. */
export default async function ResultadosPage() {
  const sessao = await exigirSessao();
  const sinais = await listarSinais("fechados");
  return <ResultadosView sinais={sinais} ehAdmin={sessao.papel === "admin"} />;
}
