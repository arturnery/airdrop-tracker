"use client";

import { useEffect } from "react";

import { marcarSinaisVistos } from "@/actions/trade";

/**
 * Zera o sininho dos sinais ao abrir a página, como `MarcarNovidadesVistas`
 * faz com as novidades. Não renderiza nada: existe só pelo efeito.
 */
export function MarcarSinaisVistos() {
  useEffect(() => {
    void marcarSinaisVistos();
  }, []);
  return null;
}
