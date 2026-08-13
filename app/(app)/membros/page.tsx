import { listarMembros } from "@/db/queries/membros";
import { exigirAdmin } from "@/lib/auth";
import { MembrosView } from "@/components/views/membros-view";

/**
 * Área do administrador.
 *
 * A lista traz e-mails de todos os cadastrados, então carregá-la junto do
 * Dataset geral significaria enviar dados de admin para qualquer sessão. Fica
 * nesta rota, e só ela.
 *
 * `exigirAdmin()` roda antes da consulta, no servidor. Quem não é
 * administrador é redirecionado para a raiz: dizer "acesso negado"
 * confirmaria que a rota existe.
 */
export default async function MembrosPage() {
  await exigirAdmin();

  const hoje = new Date().toISOString().slice(0, 10);
  const membros = await listarMembros(hoje);

  return <MembrosView membros={membros} hoje={hoje} />;
}
