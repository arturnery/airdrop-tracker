import { listarMembros } from "@/db/queries/membros";
import { MembrosView } from "@/components/views/membros-view";

export const metadata = { title: "Membros · airdrop-tracker" };

/**
 * Área do administrador.
 *
 * A lista traz e-mails de todos os cadastrados, então carregá-la junto do
 * Dataset geral significaria enviar dados de admin para qualquer sessão. Fica
 * nesta rota, e só ela.
 *
 * Quando o Auth.js entrar, `exigirAdmin()` roda aqui — no servidor, antes de a
 * query ser feita. Esconder o link do menu não é controle (§9.4).
 */
export default async function MembrosPage() {
  const hoje = new Date().toISOString().slice(0, 10);
  const membros = await listarMembros(hoje);

  return <MembrosView membros={membros} hoje={hoje} />;
}
