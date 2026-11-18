import { AvisosView } from "@/components/views/avisos-view";
import { listarAvisos } from "@/db/queries/avisos";
import { exigirSessao } from "@/lib/auth";
import { env } from "@/lib/env";

/** Mural de avisos da área Airdrops. Todos leem; quem administra publica. */
export default async function AvisosPage() {
  const sessao = await exigirSessao();
  const avisos = await listarAvisos("airdrops");
  return (
    <AvisosView avisos={avisos} ehAdmin={sessao.papel === "admin"} discordConfigurado={Boolean(env.DISCORD_WEBHOOK_AVISOS)} />
  );
}
