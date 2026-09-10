"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Interrogação ao lado de um rótulo, explicando como o número é calculado.
 *
 * Existe porque três dos números do sistema respondem perguntas parecidas e
 * são fáceis de confundir: quanto foi empregado, quanto está lá agora e quanto
 * sobrou. Já houve dúvida legítima sobre cada um deles, e a resposta estava só
 * na documentação, que ninguém abre no meio de uma conferência.
 *
 * **O gatilho é um `<button>`, não um ícone solto.** Radix abre no passar do
 * mouse e também no foco por teclado, então quem navega com Tab recebe a mesma
 * explicação. Um `<span>` com `title` funcionaria só no mouse, e o texto do
 * `title` do navegador não é lido por parte dos leitores de tela.
 *
 * O ícone é decorativo (`aria-hidden`); quem anuncia o botão é o `aria-label`,
 * que nomeia o número explicado em vez de dizer só "ajuda".
 */
export function Ajuda({
  sobre,
  children,
  className,
}: {
  /** O que está sendo explicado, para o rótulo do leitor de tela. */
  sobre: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={`Como ${sobre} é calculado`}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
              className,
            )}
          >
            <HelpCircle className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipPrimitive.Trigger>

        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              "border-border bg-popover text-popover-foreground z-50 max-w-72 rounded-md border px-3 py-2 text-xs leading-relaxed shadow-md",
              "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0",
            )}
          >
            {children}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/**
 * Os textos ficam aqui, e não espalhados pelas telas, porque o mesmo número
 * aparece no painel, na lista e na aba do projeto. Explicação divergente entre
 * telas é pior que explicação nenhuma: ela dá a impressão de que os números
 * também divergem.
 */
export const explicacoes = {
  capital: (
    <>
      O máximo do seu dinheiro que esteve empregado <strong>ao mesmo tempo</strong>.
      Recolocar o mesmo valor depois de sacar não conta duas vezes, e sacar o
      lucro não reduz o que já esteve lá. É a base do cálculo do ROI.
    </>
  ),
  exposicao: (
    <>
      Quanto está no projeto <strong>agora</strong>: depósitos, menos retiradas,
      mais rendimento e resultado de trade. Um depósito em token entra pelo valor
      em dólar lançado, sem revalorização por preço de mercado. Volume operado e
      taxa de gas ficam de fora.
    </>
  ),
  resultado: (
    <>
      O que sobrou: <strong>exposição + retirado + airdrop recebido − aportado −
      taxas</strong>. O retirado entra somado porque o dinheiro sacado continua
      sendo seu, mesmo já tendo saído da plataforma.
    </>
  ),
  volume: (
    <>
      Soma dos lançamentos de volume operado. Mede atividade para critério de
      elegibilidade, e por isso <strong>não entra no saldo nem no resultado</strong>.
    </>
  ),
} as const;
