import type { IsoDate } from "./types";

/**
 * Histórico de mudanças, na linguagem de quem usa.
 *
 * Deliberadamente **não** é o DEVLOG publicado. O DEVLOG explica por que uma
 * decisão foi tomada, com nomes de função e estrutura de banco; serve para
 * documentar o projeto. Aqui a pergunta é outra: o que mudou para mim?
 *
 * "A action atualizava tasks.dueDate mas a tela lista ocorrências" vira
 * "editar a data de uma tarefa não estava salvando".
 *
 * Dado tipado em vez de markdown por dois motivos: nenhuma dependência nova
 * para renderizar, e o compilador recusa entrada pela metade.
 *
 * **Entra junto com a mudança, no mesmo commit.** Changelog desatualizado é
 * pior que nenhum: anuncia uma versão que não corresponde ao que está no ar.
 */

export type TipoMudanca = "novidade" | "correcao" | "melhoria";

export type Mudanca = {
  tipo: TipoMudanca;
  texto: string;
};

export type Versao = {
  versao: string;
  data: IsoDate;
  mudancas: Mudanca[];
};

export const rotulos: Record<TipoMudanca, string> = {
  novidade: "Novidade",
  correcao: "Correção",
  melhoria: "Melhoria",
};

/** Mais recente primeiro: é o que interessa a quem abre a página. */
export const changelog: Versao[] = [
  {
    versao: "0.7",
    data: "2026-08-11",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "A conta de um lançamento agora pode ser trocada na edição. Antes só dava para apagar e refazer.",
      },
      {
        tipo: "melhoria",
        texto:
          "Ao lançar, só aparecem as contas vinculadas àquele projeto, em vez de todas.",
      },
      {
        tipo: "correcao",
        texto:
          "O gráfico da visão geral, a tabela de projetos e o total de contas mostravam o total já depositado, enquanto os cartões mostravam o capital atual. Agora todos mostram o mesmo número.",
      },
    ],
  },
  {
    versao: "0.6",
    data: "2026-08-11",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Tarefas recorrentes passam a se renovar sozinhas. Antes a periodicidade era guardada mas nada acontecia: concluir a de hoje não criava a de amanhã.",
      },
      {
        tipo: "novidade",
        texto:
          "Esqueci minha senha: o pedido chega para quem administra, que gera uma senha temporária. Ao entrar com ela, o sistema pede que você defina a sua antes de continuar.",
      },
      {
        tipo: "novidade",
        texto: "Esta página, com o que mudou a cada atualização.",
      },
    ],
  },
  {
    versao: "0.5",
    data: "2026-08-10",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Metas ganharam aba própria e agora podem ser editadas, não só criadas e excluídas.",
      },
      {
        tipo: "novidade",
        texto:
          "Projetos de perps mostram o volume operado direto no cartão, sem precisar abrir.",
      },
      {
        tipo: "correcao",
        texto: "Editar a data de uma tarefa não estava salvando.",
      },
      {
        tipo: "melhoria",
        texto:
          "Campos de valor e de data confirmam embaixo como o dado foi entendido, para conferir antes de salvar.",
      },
    ],
  },
  {
    versao: "0.4",
    data: "2026-08-10",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "Registrar uma retirada aumentava o saldo do projeto em vez de diminuir. Agora basta informar a quantia: o sinal vem do tipo do lançamento.",
      },
      {
        tipo: "correcao",
        texto:
          "O resultado aparecia diferente na lista e dentro do projeto. Sacar o que sobrou deixou de ser contabilizado como prejuízo.",
      },
      {
        tipo: "melhoria",
        texto:
          "O capital deixou de somar tudo que já foi depositado e passa a mostrar o que ainda está aplicado: depósitos menos retiradas.",
      },
    ],
  },
  {
    versao: "0.3",
    data: "2026-08-07",
    mudancas: [
      {
        tipo: "correcao",
        texto: "Trocar o nome no perfil só aparecia depois de sair e entrar de novo.",
      },
      {
        tipo: "correcao",
        texto:
          "Criar tarefa deixando a conta em branco não adicionava nada quando o projeto ainda não tinha lançamentos.",
      },
      {
        tipo: "melhoria",
        texto: "Marcar tarefa como concluída passou a responder na hora.",
      },
    ],
  },
  {
    versao: "0.2",
    data: "2026-08-06",
    mudancas: [
      {
        tipo: "novidade",
        texto: "Aba de perfil, com troca de nome e de senha.",
      },
      {
        tipo: "novidade",
        texto:
          "Entrada com e-mail e senha, e fila de aprovação: cada pessoa vê apenas os próprios dados.",
      },
    ],
  },
];

/** Versão mais recente, para exibir junto ao link no rodapé. */
export const versaoAtual = changelog[0]?.versao ?? "0.0";
