import { listarFeedback } from "@/db/queries/feedback";
import { exigirAdmin } from "@/lib/auth";
import { SuporteView } from "@/components/views/suporte-view";
import { SaudeDasIAs, type LinhaDaSaude } from "@/components/saude-ia";
import { listarSaude } from "@/db/queries/saude-ia";
import { alvosDa, type Tarefa } from "@/lib/alvos-ia";

/**
 * Caixa de entrada dos relatos. Ver ARCHITECTURE.md §14.
 *
 * Mesma proteção da área de membros: a lista traz e-mails e mensagens de outras
 * pessoas, então `exigirAdmin()` roda no servidor antes da consulta, e a rota
 * fica fora do Dataset geral.
 */
export default async function SuportePage() {
  await exigirAdmin();
  const [relatos, saude] = await Promise.all([listarFeedback(), listarSaude()]);

  // Os modelos configurados agora, com as tarefas em que cada um entra. Um
  // modelo que saiu da configuração some do quadro, mesmo com histórico.
  const NOMES: Record<Tarefa, string> = { lancamento: "Lançar com IA", print: "Ler print de operação", aviso: "Aviso com IA" };
  const tarefas = new Map<string, string[]>();
  for (const t of Object.keys(NOMES) as Tarefa[]) {
    for (const a of alvosDa(t)) tarefas.set(a.modelo, [...(tarefas.get(a.modelo) ?? []), NOMES[t]]);
  }
  const linhas: LinhaDaSaude[] = [...tarefas.entries()].map(([modelo, usos]) => {
    const s = saude.find((x) => x.modelo === modelo);
    return {
      modelo,
      tarefas: usos,
      ultimoOk: s?.ultimoOk ?? null,
      ultimaFalha: s?.ultimaFalha ?? null,
      tipoFalha: s?.tipoFalha ?? null,
      detalheFalha: s?.detalheFalha ?? null,
      falhasSeguidas: s?.falhasSeguidas ?? 0,
    };
  });

  return <SuporteView relatos={relatos} saude={<SaudeDasIAs linhas={linhas} />} />;
}
