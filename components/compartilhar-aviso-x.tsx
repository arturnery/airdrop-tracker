"use client";

import { useState } from "react";
import { CornerDownRight } from "lucide-react";

import { IconeX } from "@/components/icones-marca";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { linkParaPostar, linkParaResponder, postRespostaDaComunidade } from "@/lib/compartilhar-x";
import { idDoPostX } from "@/lib/interpretar-aviso";
import { cn } from "@/lib/utils";

/**
 * Compartilhar um aviso no X em duas partes: o anúncio (com o post oficial
 * citado) e, logo abaixo, a resposta com a divulgação da comunidade.
 *
 * O link de publicação do X abre um post por vez, e uma resposta precisa do
 * id do post respondido. Por isso a segunda etapa pede o link do post que
 * acabou de ser publicado: com ele, a resposta já abre ligada ao anúncio.
 */
export function CompartilharAvisoX({ anuncio }: { anuncio: string }) {
  const [linkDoPost, setLinkDoPost] = useState("");
  const resposta = postRespostaDaComunidade();
  const id = idDoPostX(linkDoPost.trim());
  const digitouInvalido = linkDoPost.trim() !== "" && !id;

  return (
    <Dialog onOpenChange={(aberto) => (aberto ? null : setLinkDoPost(""))}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="gap-1.5">
          <IconeX className="size-3.5" />
          Compartilhar no X
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar no X</DialogTitle>
          <DialogDescription>Em duas partes: o anúncio, e logo abaixo a resposta com o convite da comunidade.</DialogDescription>
        </DialogHeader>

        <ol className="space-y-5">
          <li>
            <Etapa n={1} titulo="Publique o anúncio" />
            <p className="border-border bg-secondary/40 mt-2 rounded-md border px-4 py-3 text-sm whitespace-pre-line [overflow-wrap:anywhere]">{anuncio}</p>
            <Button asChild className="mt-3 w-full gap-1.5">
              <a href={linkParaPostar(anuncio)} target="_blank" rel="noopener noreferrer">
                <IconeX className="size-3.5" />
                Abrir o X com o anúncio
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </Button>
          </li>

          <li>
            <Etapa n={2} titulo="Responda com o convite" />
            <label className="mt-2 block text-sm">
              <span className="text-muted-foreground">Depois de publicar, copie o link do seu post e cole aqui:</span>
              <input
                value={linkDoPost}
                onChange={(e) => setLinkDoPost(e.target.value)}
                inputMode="url"
                autoComplete="off"
                placeholder="https://x.com/seu_perfil/status/..."
                aria-invalid={digitouInvalido || undefined}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive mt-1.5 h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]"
              />
            </label>
            {digitouInvalido ? (
              <p className="text-negative mt-1 text-xs">Esse não é o link de um post do X. Ele termina em /status/ e um número.</p>
            ) : null}
            <p className="border-border bg-secondary/40 mt-3 flex gap-2 rounded-md border px-4 py-3 text-sm whitespace-pre-line">
              <CornerDownRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{resposta}</span>
            </p>
            {id ? (
              <Button asChild variant="outline" className="mt-3 w-full gap-1.5">
                <a href={linkParaResponder(resposta, id)} target="_blank" rel="noopener noreferrer">
                  <IconeX className="size-3.5" />
                  Abrir o X com a resposta
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" className="mt-3 w-full" disabled>
                Cole o link do anúncio para liberar a resposta
              </Button>
            )}
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function Etapa({ n, titulo }: { n: number; titulo: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium">
      <span className={cn("bg-brand/15 text-brand-legivel flex size-6 items-center justify-center rounded-full text-xs font-semibold")}>{n}</span>
      {titulo}
    </p>
  );
}
