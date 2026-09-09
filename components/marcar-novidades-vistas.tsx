"use client";

import { useEffect } from "react";

import { marcarNovidadesVistas } from "@/actions/perfil";

/**
 * Marca a versão atual como vista, uma vez, ao abrir `/novidades`.
 *
 * Não renderiza nada: existe só pelo efeito. Fica num componente à parte
 * porque a página em si não precisa de estado nem de "use client" para o
 * resto do conteúdo, que é só leitura.
 */
export function MarcarNovidadesVistas() {
  useEffect(() => {
    void marcarNovidadesVistas();
  }, []);

  return null;
}
