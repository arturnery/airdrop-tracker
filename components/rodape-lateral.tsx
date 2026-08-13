"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Loader2, LogOut, Sparkles } from "lucide-react";

import { sair } from "@/actions/auth";
import { Suporte } from "@/components/forms/suporte";
import { versaoAtual } from "@/lib/changelog";
import { cn } from "@/lib/utils";

/**
 * Bloco inferior da barra lateral: suporte, novidades e sair.
 *
 * Separado da navegação por uma linha, e a separação é semântica, não estética:
 * acima ficam os lugares do trabalho, aqui ficam as ações sobre o sistema. Sair
 * no meio dos links de dados seria um clique perigoso perto dos cotidianos.
 *
 * Suporte estava no rodapé do conteúdo e subiu para cá, que é onde produtos
 * costumam colocá-lo. Ganha em previsibilidade: quem procura ajuda olha o menu,
 * não o fim da página, e continua funcionando como diálogo, sem tirar a pessoa
 * da tela onde o problema apareceu.
 */
export function RodapeLateral({ recolhida = false }: { recolhida?: boolean }) {
  const [saindo, iniciar] = useTransition();

  const linha = cn(
    "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
    recolhida && "justify-center px-0",
  );

  /* Recolhida, o rótulo sai da tela e continua no DOM: leitor de tela e busca
     da página seguem encontrando a palavra. */
  const rotulo = cn("truncate", recolhida && "sr-only");

  return (
    <div className="border-border space-y-0.5 border-t p-3">
      <Suporte className={linha} rotuloOculto={recolhida} />

      <Link href="/novidades" className={linha}>
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        <span className={rotulo}>Novidades</span>
        {recolhida ? null : (
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
        {saindo ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className={rotulo}>{saindo ? "Saindo…" : "Sair"}</span>
      </button>
    </div>
  );
}
