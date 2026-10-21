import { RankingResultadosView } from "@/components/views/ranking-view";
import { aparecoNoRanking, carregarMembrosDoRanking } from "@/db/queries/ranking";
import { exigirSessao } from "@/lib/auth";
import { airdropsRecentes, rankingDeResultado } from "@/lib/ranking";

/** Ranking de resultados da comunidade, com os últimos airdrops registrados. */
export default async function RankingPage() {
  const sessao = await exigirSessao();
  const [membros, euApareco] = await Promise.all([carregarMembrosDoRanking(), aparecoNoRanking(sessao.id)]);
  return (
    <RankingResultadosView
      linhas={rankingDeResultado(membros)}
      recentes={airdropsRecentes(membros)}
      meuId={sessao.id}
      euApareco={euApareco}
    />
  );
}
