import { RankingPontosView } from "@/components/views/ranking-view";
import { aparecoNoRanking, carregarMembrosDoRanking } from "@/db/queries/ranking";
import { exigirSessao } from "@/lib/auth";
import { rankingDePontos } from "@/lib/ranking";

/** Ranking de pontos da comunidade, um por projeto. */
export default async function RankingPontosPage() {
  const sessao = await exigirSessao();
  const [membros, euApareco] = await Promise.all([carregarMembrosDoRanking(), aparecoNoRanking(sessao.id)]);
  return (
    <RankingPontosView projetos={rankingDePontos(membros)} meuId={sessao.id} euApareco={euApareco} />
  );
}
