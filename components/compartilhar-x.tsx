"use client";

import { ImagePlus } from "lucide-react";

import { IconeX } from "@/components/icones-marca";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { linkParaPostar } from "@/lib/compartilhar-x";

/**
 * Compartilhar no X em dois passos: primeiro a prévia do post e o lembrete
 * da foto, depois o X.
 *
 * O passo do meio existe porque o link de publicação do X só leva texto: não
 * há como anexar imagem por ele. O print dos pontos, do volume ou do
 * resultado é o que faz o post chamar atenção, então a pessoa é lembrada de
 * anexar antes de abrir o X, e não depois que já publicou.
 *
 * É um link, e não uma chamada à API: quem publica é a pessoa, na conta dela,
 * depois de ver o texto.
 */
export function BotaoCompartilharX({
  texto,
  doQue,
  rotulo = "Compartilhar no X",
}: {
  texto: string;
  /** O que o print deve mostrar: "dos seus pontos", "do seu volume"... */
  doQue: string;
  rotulo?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="gap-1.5">
          <IconeX className="size-3.5" />
          {rotulo}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar no X</DialogTitle>
          <DialogDescription>
            O X abre com este texto pronto. Você confere, pode mudar o que quiser, e publica.
          </DialogDescription>
        </DialogHeader>

        <p className="border-border bg-secondary/40 rounded-md border px-4 py-3 text-sm whitespace-pre-line">
          {texto}
        </p>

        <div className="border-caution/40 bg-caution/10 flex gap-3 rounded-md border px-4 py-3 text-sm">
          <ImagePlus className="text-caution mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-medium">Anexe um print {doQue}</strong> antes de publicar: post
            com imagem chama muito mais atenção. Tire o print agora, e no X use o ícone de imagem
            para anexar.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button asChild>
            <a href={linkParaPostar(texto)} target="_blank" rel="noopener noreferrer">
              <IconeX className="size-3.5" />
              Abrir o X
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
