import { IconeX } from "@/components/icones-marca";
import { linkParaPostar } from "@/lib/compartilhar-x";
import { cn } from "@/lib/utils";

/**
 * Abre a tela de publicar do X com o post pronto. É um link, e não uma
 * chamada à API: quem publica é a pessoa, na conta dela, depois de ver o
 * texto. O número vai no post só porque ela clicou para compartilhá-lo.
 */
export function BotaoCompartilharX({
  texto,
  rotulo = "Compartilhar no X",
  className,
}: {
  texto: string;
  rotulo?: string;
  className?: string;
}) {
  return (
    <a
      href={linkParaPostar(texto)}
      target="_blank"
      rel="noopener noreferrer"
      title="Abre o X com o post pronto para você conferir e publicar"
      className={cn(
        "border-border hover:bg-accent focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <IconeX className="size-3.5" />
      {rotulo}
      <span className="sr-only">(abre o X em nova aba)</span>
    </a>
  );
}
