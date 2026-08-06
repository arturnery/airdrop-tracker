import { PerfilView } from "@/components/views/perfil-view";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Perfil · airdrop-tracker" };

export default async function PerfilPage() {
  const sessao = await exigirSessao();
  return <PerfilView sessao={sessao} />;
}
