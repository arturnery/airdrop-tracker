import { DashboardView } from "@/components/views/dashboard-view";
import { listarLives } from "@/db/queries/comunidade";
import { proximasOcorrencias } from "@/lib/lives";

export default async function DashboardPage() {
  // Só a próxima dos próximos sete dias: mais longe que isso não é "aviso".
  const proximaLive = proximasOcorrencias(await listarLives(), new Date(), 7)[0] ?? null;
  return <DashboardView proximaLive={proximaLive} />;
}
