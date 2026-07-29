import { ProjetoView } from "@/components/views/projeto-view";

/*
 * Sem generateStaticParams: no modo local os projetos vivem no navegador, então
 * o servidor não conhece os slugs criados por você. A rota resolve sob demanda
 * e a view avisa se o projeto não existir.
 */
export default async function ProjetoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProjetoView slug={slug} />;
}
