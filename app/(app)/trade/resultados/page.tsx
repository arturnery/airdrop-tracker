import { ResultadosView } from "@/components/views/resultados-view";
import { comEntradas, listarSinais } from "@/db/queries/trade";
import { exigirSessao } from "@/lib/auth";

/** Operações fechadas da área de trade, com o placar. Todos que entram leem. */
export default async function ResultadosPage() {
  const sessao = await exigirSessao();
  const sinais = await comEntradas(await listarSinais("fechados"), sessao.id);
  return <ResultadosView sinais={sinais} ehAdmin={sessao.papel === "admin"} />;
}
