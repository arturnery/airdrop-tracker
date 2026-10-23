import { FeedXView } from "@/components/views/feed-x-view";
import { destaquesDoFeed, lerListaDoX } from "@/db/queries/feed-x";
import { exigirSessao } from "@/lib/auth";
import { projetosDoFeed } from "@/lib/feed-x";

/** Feed do X dos projetos que a comunidade farma. Igual para todos. */
export default async function FeedXPage() {
  const sessao = await exigirSessao();
  const [lista, destaques] = await Promise.all([lerListaDoX(), destaquesDoFeed()]);
  return <FeedXView lista={lista} projetos={projetosDoFeed(destaques)} ehAdmin={sessao.papel === "admin"} />;
}
