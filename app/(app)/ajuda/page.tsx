import { AjudaView } from "@/components/views/ajuda-view";

/**
 * FAQ e contato com a equipe. Ver `components/views/ajuda-view.tsx`.
 *
 * Rota de leitura, sem dado de usuário: a página inteira é a mesma para
 * qualquer conta aprovada, por isso não busca nada aqui. A proteção vem do
 * layout do grupo `(app)`, que já exige sessão antes de qualquer rota dentro
 * dele.
 */
export default function AjudaPage() {
  return <AjudaView />;
}
