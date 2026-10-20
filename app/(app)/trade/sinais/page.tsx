import { SinaisView } from "@/components/views/sinais-view";
import { listarSinais } from "@/db/queries/trade";
import { exigirSessao } from "@/lib/auth";

/**
 * Sinais de trade publicados. Todos que entram leem; por enquanto só quem
 * administra publica, até a permissão do professor existir.
 */
export default async function SinaisPage() {
  const sessao = await exigirSessao();
  const sinais = await listarSinais();
  return <SinaisView sinais={sinais} ehAdmin={sessao.papel === "admin"} />;
}
