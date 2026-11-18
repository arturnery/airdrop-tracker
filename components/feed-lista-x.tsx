"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A Lista do X mostrada pelo widget oficial (widgets.js).
 *
 * O feed é criado pelo **número** da Lista (`createTimeline` com
 * `sourceType: "list"`), e não por um link `a.twitter-timeline` que o script
 * interpreta. O link canônico de Lista (`x.com/i/lists/<id>`) o script lê
 * errado: toma o "i" por nome de usuário e o número por nome da lista, pede
 * ao X uma lista que não existe nesse formato e recebe erro (429), e o quadro
 * fica vazio. Pelo número, o X responde com os posts mesmo para quem não
 * está logado nele.
 *
 * Como o iframe é de outro domínio, a página não sabe se o feed apareceu de
 * fato; quem chama mostra sempre, logo abaixo, a saída para abrir a Lista no X.
 */
type Widgets = {
  createTimeline: (fonte: { sourceType: "list"; id: string }, alvo: HTMLElement, opcoes: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  interface Window {
    twttr?: { widgets?: Widgets; ready?: (f: (t: { widgets: Widgets }) => void) => void };
  }
}

const SCRIPT = "https://platform.twitter.com/widgets.js";

/** Espera o widgets.js ficar pronto, carregando-o uma vez só. */
function quandoProntos(): Promise<Widgets> {
  return new Promise((resolve, reject) => {
    if (window.twttr?.widgets?.createTimeline) return resolve(window.twttr.widgets);
    let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.charset = "utf-8";
      document.body.appendChild(s);
    }
    const pronto = () => (window.twttr?.widgets?.createTimeline ? resolve(window.twttr.widgets) : reject(new Error("widgets.js sem createTimeline")));
    s.addEventListener("load", pronto, { once: true });
    s.addEventListener("error", () => reject(new Error("widgets.js não carregou")), { once: true });
  });
}

export function FeedListaX({ lista }: { lista: string }) {
  // O widget escreve dentro desta caixa; o React nunca põe filhos nela.
  const caixa = useRef<HTMLDivElement>(null);
  const id = lista.match(/\/lists\/(\d+)/)?.[1] ?? null;
  const [estado, setEstado] = useState<{ id: string | null; fase: "pronto" | "falhou" } | null>(null);
  const fase = estado?.id === id ? estado.fase : "carregando";

  useEffect(() => {
    const el = caixa.current;
    if (!el || !id) return;
    let cancelado = false;
    quandoProntos()
      .then((widgets) => {
        if (cancelado) return;
        // Trocar de Lista recria o feed: o que estava lá sai antes.
        el.replaceChildren();
        return widgets.createTimeline({ sourceType: "list", id }, el, {
          theme: "dark",
          height: 760,
          dnt: true,
          chrome: "noheader nofooter transparent",
        });
      })
      // Quando o X não consegue montar o feed, createTimeline resolve vazio
      // em vez de rejeitar.
      .then((widget) => {
        if (!cancelado) setEstado({ id, fase: widget ? "pronto" : "falhou" });
      })
      .catch(() => {
        if (!cancelado) setEstado({ id, fase: "falhou" });
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  return (
    <div className="min-h-40">
      {fase === "carregando" ? <p className="text-muted-foreground text-sm">Carregando o feed do X…</p> : null}
      {fase === "falhou" ? (
        <p className="text-muted-foreground text-sm">O X não carregou o feed agora. Use o botão abaixo para abrir a Lista no X.</p>
      ) : null}
      <div ref={caixa} />
    </div>
  );
}
