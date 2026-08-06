import { carregarUsuario } from "@/db/queries/usuario";
import { PerfilView } from "@/components/views/perfil-view";
import { exigirSessao } from "@/lib/auth";

export const metadata = { title: "Perfil · airdrop-tracker" };

export default async function PerfilPage() {
  const sessao = await exigirSessao();
  // Do banco, não do token: o nome pode ter sido trocado depois do login.
  const usuario = await carregarUsuario(sessao.id);

  return (
    <PerfilView
      sessao={{
        ...sessao,
        nome: usuario?.nome ?? sessao.nome,
        email: usuario?.email ?? sessao.email,
      }}
    />
  );
}
