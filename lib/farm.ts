import { normalizar, type Dataset } from "./dataset";
import type { ProjectStatus } from "./types";

/**
 * Regras da aba "Farmando agora" (ARCHITECTURE §21).
 *
 * Estar em farm é escolha da pessoa, guardada à parte do status
 * (`projects.farmando`), mas amarrada a ele em dois pontos:
 *
 * - **Só entra projeto ativo.** Pausado, distribuído e descartado ficam em
 *   "Todos os projetos" como registro, sem botão de farmar.
 * - **Sair exige motivo, e o motivo é o status novo.** Não existe tirar do
 *   farm e deixar "ativo": quem para de farmar diz se pausou, se foi
 *   distribuído, se desistiu ou se voltou a estudar.
 */

/** Status que contam como "ainda dá para farmar". TGE anunciado ainda pontua. */
export const STATUS_DE_FARM: readonly ProjectStatus[] = ["ativo", "tge_anunciado"];

export const podeFarmar = (status: ProjectStatus) => STATUS_DE_FARM.includes(status);

/** Por que saiu do farm: cada motivo é o status que o projeto passa a ter. */
export const MOTIVOS_DE_SAIDA: { status: Exclude<ProjectStatus, "ativo" | "tge_anunciado">; rotulo: string }[] = [
  { status: "pausado", rotulo: "Pausei o farm" },
  { status: "distribuido", rotulo: "Já foi distribuído" },
  { status: "descartado", rotulo: "Desisti do projeto" },
  { status: "pesquisando", rotulo: "Voltei a estudar" },
];

/**
 * Destaques que a pessoa ainda pode adicionar: publicados, com o projeto de
 * origem ativo, e que ela ainda não tem. "Ter" vale para três jeitos: ter
 * adotado a entrada, ser a dona do projeto de origem (quem administra vê os
 * próprios destaques no meio dos dela, e não como algo a adicionar), ou já
 * ter cadastrado à mão um projeto com o mesmo nome: o card dela está logo
 * abaixo, e oferecer o destaque só levaria a um nome repetido.
 */
export function destaquesParaAdicionar(ds: Dataset): Dataset["catalogProjects"] {
  const adotados = new Set(ds.projects.map((p) => p.adoptedFromId).filter(Boolean));
  const meus = new Set(ds.projects.map((p) => p.id));
  const nomes = new Set(ds.projects.map((p) => normalizar(p.name)));
  return ds.catalogProjects.filter(
    (c) =>
      c.publishedAt !== null &&
      podeFarmar(c.status) &&
      !adotados.has(c.id) &&
      !(c.sourceProjectId !== null && meus.has(c.sourceProjectId)) &&
      !nomes.has(normalizar(c.name)),
  );
}

/**
 * O status novo do destaque que a pessoa ainda não viu, se houver.
 *
 * Aparece quando quem administra mudou o status do projeto destacado depois
 * da última vez que ela viu (`statusDoDestaqueVisto`), e só se o dela ainda
 * for diferente: quem já pausou por conta própria não precisa ser avisado de
 * que o admin pausou também.
 */
export function mudancaDoDestaque(
  projeto: Dataset["projects"][number],
  catalogo: Dataset["catalogProjects"],
): ProjectStatus | null {
  if (!projeto.adoptedFromId) return null;
  const entrada = catalogo.find((c) => c.id === projeto.adoptedFromId);
  if (!entrada) return null;
  if (entrada.status === projeto.statusDoDestaqueVisto) return null;
  if (entrada.status === projeto.status) return null;
  return entrada.status;
}
