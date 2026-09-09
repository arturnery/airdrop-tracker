"use client";

import Link from "next/link";
import { useTransition } from "react";
import { HelpCircle, Loader2, LogOut, Sparkles } from "lucide-react";

import { sair } from "@/actions/auth";
import { versaoAtual } from "@/lib/changelog";
import { cn } from "@/lib/utils";

/**
 * Bloco inferior da barra lateral: ajuda, novidades e sair.
 *
 * Separado da navegação por uma linha, e a separação é semântica, não estética:
 * acima ficam os lugares do trabalho, aqui ficam as ações sobre o sistema. Sair
 * no meio dos links de dados seria um clique perigoso perto dos cotidianos.
 *
 * "Suporte" virou "Ajuda" e trocou de diálogo por página (ver `/ajuda`): o
 * FAQ precisava de espaço que um diálogo não tem, e "Suporte" já nomeia outra
 * coisa neste sistema, a caixa de entrada de quem administra. O diálogo de
 * relato não sumiu, só mudou de porta: mora dentro de `/ajuda`, na seção
 * "Falar com a equipe".
 *
 * A bolha atrás do ícone é a mesma linguagem do menu principal, e o tom fica
 * neutro nos três: Ajuda, Novidades e Sair não são lugares como os do menu,
 * são ações, e cor de item ali competiria com o significado que a cor tem no
 * resto do sistema.
 */
export function RodapeLateral({
  recolhida = false,
  novidadesNaoVistas = 0,
}: {
  recolhida?: boolean;
  /** Quantas mudanças do changelog a pessoa ainda não abriu. */
  novidadesNaoVistas?: number;
}) {
  const temNovidade = novidadesNaoVistas > 0;
  const [saindo, iniciar] = useTransition();

  const linha = cn(
    "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:ring-ring flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
    recolhida && "justify-center px-0",
  );

  const bolha =
    "flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary relative";

  /* Recolhida, o rótulo sai da tela e continua no DOM: leitor de tela e busca
     da página seguem encontrando a palavra. */
  const rotulo = cn("truncate", recolhida && "sr-only");

  return (
    <div className="border-border space-y-0.5 border-t p-3">
      <Link href="/ajuda" className={linha}>
        <span className={bolha}>
          <HelpCircle className="size-4" aria-hidden="true" />
        </span>
        <span className={rotulo}>Ajuda</span>
      </Link>

      <Link href="/novidades" className={linha}>
        <span className={bolha}>
          <Sparkles className="size-4" aria-hidden="true" />
          {/* Recolhida, o rótulo some e o ponto vira o único aviso: mesma
              lógica do sino de tarefas atrasadas no menu principal.
              Vermelho de destaque (não o vermelho de perda financeira, que
              é `--negative`): aqui é aviso de conteúdo novo, não de dinheiro
              perdido, e os dois não podem ter a mesma cor. */}
          {temNovidade && recolhida ? (
            <span
              aria-label={`${novidadesNaoVistas} novidade(s) não vista(s)`}
              className="bg-destructive absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
            >
              {novidadesNaoVistas > 9 ? "9+" : novidadesNaoVistas}
            </span>
          ) : null}
        </span>
        <span className={rotulo}>Novidades</span>
        {recolhida ? null : temNovidade ? (
          <span className="bg-destructive tabular ml-auto rounded-full px-1.5 py-0.5 text-xs font-bold text-white">
            {novidadesNaoVistas > 9 ? "9+" : novidadesNaoVistas}
          </span>
        ) : (
          <span className="text-muted-foreground/70 ml-auto text-xs tabular">
            {versaoAtual}
          </span>
        )}
      </Link>

      <button
        type="button"
        className={linha}
        disabled={saindo}
        onClick={() =>
          iniciar(async () => {
            await sair();
          })
        }
      >
        <span className={bolha}>
          {saindo ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
        </span>
        <span className={rotulo}>{saindo ? "Saindo…" : "Sair"}</span>
      </button>
    </div>
  );
}
