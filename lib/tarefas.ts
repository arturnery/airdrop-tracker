/**
 * Regras de tarefa e de escopo de conta que não dependem de banco.
 *
 * Fica separado da Server Action de propósito: a decisão de "para quais contas
 * esta tarefa vale" tem casos de borda que merecem teste, e testá-la dentro da
 * action exigiria um banco de verdade.
 */

/**
 * Contas que recebem ocorrências de uma tarefa.
 *
 * `escolhida` vazia significa "todas as contas". A parte não óbvia é o que
 * "todas" quer dizer num projeto sem nenhum vínculo: o vínculo projeto×conta só
 * nasce no primeiro lançamento, então um projeto recém-criado tem a lista
 * vazia. Resolver isso para "nenhuma conta" criava a tarefa sem ocorrência
 * alguma, e ela não aparecia em tela nenhuma.
 *
 * Por isso a queda para as contas da própria pessoa: antes de existir
 * lançamento, "todas as contas do projeto" e "todas as minhas contas" são a
 * mesma coisa.
 */
export function contasAlvoDaTarefa(
  escolhida: string | null,
  vinculadasAoProjeto: string[],
  todasDoUsuario: string[],
): string[] {
  if (escolhida) return [escolhida];
  if (vinculadasAoProjeto.length > 0) return vinculadasAoProjeto;
  return todasDoUsuario;
}

/**
 * Contas que podem receber um lançamento naquele projeto.
 *
 * Enquanto o projeto tem vínculos, a lista é só a deles: oferecer todas as
 * carteiras num projeto que usa duas é convite a lançar na conta errada, e o
 * erro só aparece depois, num saldo que não bate.
 *
 * Sem nenhum vínculo, todas valem. É o caso do projeto recém-criado, cujo
 * primeiro lançamento é justamente o que cria o vínculo: restringir ali
 * tornaria impossível começar.
 *
 * Mesma regra de `contasAlvoDaTarefa`, e de propósito: se as duas telas
 * divergissem, a tarefa cairia numa conta em que não se pode lançar.
 */
export function contasDisponiveisNoProjeto(
  vinculadasAoProjeto: string[],
  todasDoUsuario: string[],
): string[] {
  return vinculadasAoProjeto.length > 0 ? vinculadasAoProjeto : todasDoUsuario;
}
