"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * Estado recolhido da barra lateral, com a preferência guardada.
 *
 * Vive num store externo e não em `useState` pelo mesmo motivo do relógio: o
 * valor nasce fora do React, no `localStorage`, e o servidor não tem como
 * conhecê-lo. Ler direto durante a renderização causaria divergência de
 * hidratação; `getServerSnapshot` devolve o padrão e o navegador corrige depois.
 *
 * A preferência persiste porque quem recolhe a barra quer trabalhar assim, não
 * naquela página só.
 */
const CHAVE = "lvl:barra-recolhida";

let recolhida = false;
const ouvintes = new Set<() => void>();

function ler(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CHAVE) === "1";
}

function alternar() {
  recolhida = !recolhida;
  window.localStorage.setItem(CHAVE, recolhida ? "1" : "0");
  for (const ouvinte of ouvintes) ouvinte();
}

function subscrever(ouvinte: () => void) {
  // Sincroniza na primeira inscrição: até aqui o valor era o padrão do servidor.
  recolhida = ler();
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function useBarraRecolhida() {
  return useSyncExternalStore(
    subscrever,
    () => recolhida,
    () => false,
  );
}

export function BotaoRecolher() {
  const estaRecolhida = useBarraRecolhida();
  const Icone = estaRecolhida ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={alternar}
      // O rótulo diz a ação, não o estado: leitor de tela anuncia o que o
      // clique faz, e não onde a interface está.
      aria-label={estaRecolhida ? "Expandir a barra lateral" : "Recolher a barra lateral"}
      title={estaRecolhida ? "Expandir" : "Recolher"}
      className="text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:ring-ring hidden shrink-0 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:block"
    >
      <Icone className="size-4" aria-hidden="true" />
    </button>
  );
}
