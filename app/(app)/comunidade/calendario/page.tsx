import { CalendarioView } from "@/components/views/calendario-view";
import { listarLives } from "@/db/queries/comunidade";
import { exigirSessao } from "@/lib/auth";
import {
  diaEHoraDeBrasilia,
  lerMes,
  limitesDoMes,
  mesDeBrasilia,
  ocorrenciasEntre,
  semanasDoMes,
} from "@/lib/lives";

/**
 * Calendário da comunidade, um mês por vez (`?mes=2026-03`; sem parâmetro, o
 * mês atual de Brasília). As ocorrências são calculadas no servidor, com o
 * relógio dele.
 */
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const sessao = await exigirSessao();
  const agora = new Date();
  const mesAtual = mesDeBrasilia(agora);
  const mes = lerMes((await searchParams).mes) ?? mesAtual;

  const { de, ate } = limitesDoMes(mes);
  const lives = await listarLives();

  return (
    <CalendarioView
      mes={mes}
      mesAtual={mesAtual}
      hoje={diaEHoraDeBrasilia(agora.toISOString()).dia}
      semanas={semanasDoMes(mes)}
      ocorrencias={ocorrenciasEntre(lives, de, ate, agora)}
      ehAdmin={sessao.papel === "admin"}
    />
  );
}
