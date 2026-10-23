import { RankingPontosView } from "@/components/views/ranking-view";
import { aparecoNoRanking, carregarDestaquesAtivos, carregarMembrosDoRanking } from "@/db/queries/ranking";
import { exigirSessao } from "@/lib/auth";
import { rankingDePontos } from "@/lib/ranking";

/** Ranking de pontos e volume: um por projeto ativo destacado. */
export default async function RankingPontosPage() {
  const sessao = await exigirSessao();
  const [membros, destaques, euApareco] = await Promise.all([
    carregarMembrosDoRanking(),
    carregarDestaquesAtivos(),
    aparecoNoRanking(sessao.id),
  ]);
  return (
    <RankingPontosView projetos={rankingDePontos(membros, destaques)} meuId={sessao.id} euApareco={euApareco} />
  );
}
