import { ComunidadeView } from "@/components/views/comunidade-view";
import { listarLives } from "@/db/queries/comunidade";
import { exigirSessao } from "@/lib/auth";
import { proximasOcorrencias } from "@/lib/lives";

/**
 * Conteúdo da comunidade, igual para todos. As ocorrências são calculadas no
 * servidor, com o relógio dele: a tela mostra datas absolutas ("qua., 15/10
 * às 20:00"), que não envelhecem com a aba aberta.
 */
export default async function LivesPage() {
  const sessao = await exigirSessao();
  const lives = await listarLives();

  return (
    <ComunidadeView
      lives={lives}
      ocorrencias={proximasOcorrencias(lives, new Date(), 14)}
      ehAdmin={sessao.papel === "admin"}
    />
  );
}
