import { MarcarSinaisVistos } from "@/components/marcar-sinais-vistos";
import { SinaisView } from "@/components/views/sinais-view";
import { comEntradas, listarSinais } from "@/db/queries/trade";
import { exigirSessao } from "@/lib/auth";
import { env } from "@/lib/env";

/**
 * Operações de trade abertas. Todos que entram leem e podem entrar nelas
 * com um valor; por enquanto só quem administra publica, até a permissão do
 * professor existir.
 */
export default async function OperacoesPage() {
  const sessao = await exigirSessao();
  const sinais = await comEntradas(await listarSinais("abertos"), sessao.id);
  return (
    <>
      <MarcarSinaisVistos />
      <SinaisView
        sinais={sinais}
        ehAdmin={sessao.papel === "admin"}
        discordConfigurado={Boolean(env.DISCORD_WEBHOOK_SINAIS)}
      />
    </>
  );
}
