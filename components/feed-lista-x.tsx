"use client";

import { useEffect, useRef } from "react";

/**
 * A Lista do X mostrada pelo widget oficial (widgets.js). O script do X
 * troca o link `a.twitter-timeline` por um iframe com o feed.
 *
 * O X só mostra o feed a quem está logado no X neste navegador; para os
 * demais, o próprio iframe diz "Rate limit exceeded". Como o iframe é de
 * outro domínio, a página não consegue saber se o feed apareceu, então quem
 * chama mostra sempre, logo abaixo, a saída para abrir a Lista no X.
 */
declare global {
  interface Window {
    twttr?: { widgets?: { load: (el?: HTMLElement) => void } };
  }
}

const SCRIPT = "https://platform.twitter.com/widgets.js";

export function FeedListaX({ lista }: { lista: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  // O widget entende o endereço antigo (twitter.com) melhor que o novo.
  const href = lista.replace("https://x.com/", "https://twitter.com/");

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    if (window.twttr?.widgets) {
      window.twttr.widgets.load(el);
      return;
    }
    if (!document.querySelector(`script[src="${SCRIPT}"]`)) {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.charset = "utf-8";
      document.body.appendChild(s);
    }
  }, [href]);

  return (
    <div ref={caixa} className="min-h-40">
      <a
        className="twitter-timeline text-muted-foreground text-sm"
        data-theme="dark"
        data-height="760"
        data-dnt="true"
        data-chrome="noheader nofooter transparent"
        href={href}
      >
        Carregando o feed do X…
      </a>
    </div>
  );
}
