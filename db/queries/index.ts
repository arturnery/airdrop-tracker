import "server-only";

import { datasetInicial, HOJE } from "./fixtures";
import {
  selectAccounts,
  selectCapitalPorProjeto,
  selectDashboardSummary,
  selectPendingTasks,
  selectProjectBySlug,
  selectProjects,
} from "@/lib/selectors";

/**
 * Camada de leitura do servidor.
 *
 * No modo local as telas não passam por aqui — elas leem o estado do
 * `DataProvider`. Estas funções existem porque são o ponto de retorno quando
 * o backend entrar: basta trocar `datasetInicial()` por consultas Drizzle e
 * as telas voltam a ser Server Components sem que `lib/selectors` mude uma
 * linha.
 */

export async function getDashboardSummary() {
  return selectDashboardSummary(datasetInicial(), HOJE);
}

export async function getCapitalPorProjeto() {
  return selectCapitalPorProjeto(datasetInicial());
}

export async function listProjects() {
  return selectProjects(datasetInicial(), HOJE);
}

export async function getProjectBySlug(slug: string) {
  return selectProjectBySlug(datasetInicial(), slug, HOJE);
}

export async function listPendingTasks() {
  return selectPendingTasks(datasetInicial(), HOJE);
}

export async function listAccounts() {
  return selectAccounts(datasetInicial());
}
