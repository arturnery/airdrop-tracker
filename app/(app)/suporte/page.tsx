import { listarFeedback } from "@/db/queries/feedback";
import { exigirAdmin } from "@/lib/auth";
import { SuporteView } from "@/components/views/suporte-view";

export const metadata = { title: "Suporte · airdrop-tracker" };

/**
 * Caixa de entrada dos relatos. Ver ARCHITECTURE.md §14.
 *
 * Mesma proteção da área de membros: a lista traz e-mails e mensagens de outras
 * pessoas, então `exigirAdmin()` roda no servidor antes da consulta, e a rota
 * fica fora do Dataset geral.
 */
export default async function SuportePage() {
  await exigirAdmin();
  const relatos = await listarFeedback();

  return <SuporteView relatos={relatos} />;
}
