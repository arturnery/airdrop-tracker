import "server-only";

import { env } from "./env";
import type { Alvo } from "./perguntar-ia";

/**
 * Qual IA faz o quê (ARCHITECTURE §18.8). Cada tarefa tem os seus modelos, e
 * trocar um deles é mudar uma variável de ambiente, sem tocar no código.
 *
 * | Tarefa       | Modelos                                                    |
 * |--------------|------------------------------------------------------------|
 * | `lancamento` | todos: Gemini principal e reserva (IA_*) e o 2º provedor (IA2_*) |
 * | `print`      | só os Gemini (IA_*): os únicos que leem imagem             |
 * | `aviso`      | IA_AVISO_*, ou na falta deles o 2º provedor (IA2_*)        |
 *
 * Os prints de operação ficam com o Gemini só para eles: ele é o único com
 * visão, e a cota gratuita dele não é gasta com o que texto resolve.
 */
export type Tarefa = "lancamento" | "print" | "aviso";

export function alvosDa(tarefa: Tarefa): Alvo[] {
  const alvos: Alvo[] = [];
  const gemini = env.IA_API_KEY ? { baseUrl: env.IA_BASE_URL, chave: env.IA_API_KEY } : null;
  const segundo =
    env.IA2_API_KEY && env.IA2_BASE_URL && env.IA2_MODELO
      ? { baseUrl: env.IA2_BASE_URL, chave: env.IA2_API_KEY, modelo: env.IA2_MODELO }
      : null;

  if (tarefa === "lancamento" || tarefa === "print") {
    if (gemini) {
      alvos.push({ ...gemini, modelo: env.IA_MODELO });
      if (env.IA_MODELO_RESERVA) alvos.push({ ...gemini, modelo: env.IA_MODELO_RESERVA });
    }
    if (tarefa === "lancamento" && segundo) alvos.push(segundo);
    return alvos;
  }

  // aviso
  if (env.IA_AVISO_MODELO) {
    const baseUrl = env.IA_AVISO_BASE_URL ?? segundo?.baseUrl;
    const chave = env.IA_AVISO_API_KEY ?? segundo?.chave;
    if (baseUrl && chave) {
      alvos.push({ baseUrl, chave, modelo: env.IA_AVISO_MODELO });
      if (env.IA_AVISO_MODELO_RESERVA) alvos.push({ baseUrl, chave, modelo: env.IA_AVISO_MODELO_RESERVA });
      return alvos;
    }
  }
  if (segundo) alvos.push(segundo);
  return alvos;
}
