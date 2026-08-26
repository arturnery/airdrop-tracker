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
    versao: "1.6",
    data: "2026-08-26",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "Ao salvar um lançamento, o formulário fechava antes de a tela receber o dado novo. No intervalo, a tabela ainda mostrava o valor antigo, e parecia que a alteração tinha se perdido. Agora o botão avisa que está salvando e o formulário só fecha quando a mudança já está na tela.",
      },
    ],
  },
  {
    versao: "1.5",
    data: "2026-08-17",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "O \"capital depositado\" mudou de conta. Ele descontava os saques do que foi depositado, e como sacar leva principal e lucro juntos, zerava justamente nos projetos que deram certo: nove dos seus apareciam com $0. Agora ele é o máximo do seu dinheiro empregado ao mesmo tempo: reciclar os mesmos $100 não conta $200, e sacar tudo não apaga mais o percentual do ROI.",
      },
      {
        tipo: "melhoria",
        texto:
          "Na aba Airdrop de um projeto marcado como Distribuído, o texto deixou de dizer \"o airdrop ainda não caiu\", que contradizia o próprio status. Agora ele lembra de registrar o recebimento, que é o que guarda token, quantidade e preço.",
      },
      {
        tipo: "novidade",
        texto:
          "Capital depositado, exposição, resultado e volume ganharam uma interrogação ao lado. Passe o mouse (ou chegue nela pelo teclado) e aparece, em uma frase, como aquele número é calculado.",
      },
      {
        tipo: "melhoria",
        texto:
          "A tabela de projetos saiu da visão geral. Ela repetia em tabela o que a aba Projetos mostra melhor, agora com busca e filtros. \"Onde está o capital\" continua no painel e já mostra a distribuição por projeto.",
      },
      {
        tipo: "melhoria",
        texto:
          "Os cards da aba de projetos foram redesenhados. O nome do projeto ficou maior, porque é por ele que se procura numa lista, e ganhou a inicial ao lado para achar a mesma linha mais rápido ao rolar. O resultado passou a ter bloco próprio, com seta de direção; depositado e exposição ficam logo abaixo.",
      },
      {
        tipo: "novidade",
        texto:
          "A aba de projetos ganhou busca por nome. Filtra enquanto você digita, ignora acento e maiúscula, e funciona junto com os filtros de status, categoria e prioridade.",
      },
    ],
  },
  {
    versao: "1.4",
    data: "2026-08-14",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "O cartão \"Capital depositado\" da visão geral podia exibir $0 mesmo com dinheiro comprometido em vários projetos. Bastava um projeto de onde você sacou bem mais do que depositou para o excesso dele apagar o capital dos outros. O cartão agora bate com a soma da tabela, e o ROI volta a aparecer.",
      },
      {
        tipo: "correcao",
        texto:
          "A lista \"Onde está o capital\" mostrava quanto foi depositado em cada projeto, e não quanto está lá agora. Um projeto onde entraram $202 e restam $20 aparecia com $202. Agora mostra o saldo atual, e projeto já encerrado sai da lista.",
      },
      {
        tipo: "novidade",
        texto:
          "Projeto com saldo impossível agora avisa em vez de exibir o número calado. É o caso de saldo negativo, ou de dinheiro que aparece sem nenhum depósito registrado: quase sempre falta lançar o depósito. O aviso some sozinho quando o lançamento entrar.",
      },
      {
        tipo: "correcao",
        texto:
          "Por algumas horas do dia 14, o lucro de trade deixou de contar no saldo dos projetos, e o saldo exibido ficou menor do que o real. Já voltou ao normal: lucro soma ao saldo e prejuízo desconta, como sempre foi.",
      },
      {
        tipo: "correcao",
        texto:
          "O airdrop recebido não estava entrando no resultado da lista de projetos nem na de contas. Um projeto que já distribuiu aparecia no vermelho na lista e no azul dentro da própria aba. Agora as duas telas mostram o mesmo número.",
      },
      {
        tipo: "novidade",
        texto:
          "Cada meta agora acumula o próprio progresso, lançado nela. Antes o número saía do volume do projeto inteiro, então três metas do mesmo projeto mostravam todas o mesmo valor. O progresso que suas metas já exibiam foi preservado como o primeiro lançamento de cada uma.",
      },
      {
        tipo: "novidade",
        texto:
          "No airdrop recebido dá para informar só o total em dólar, sem quantidade e preço. Serve para quando o token já foi vendido ou o número veio pronto da corretora.",
      },
      {
        tipo: "novidade",
        texto:
          "A aba de projetos ganhou filtro por status.",
      },
      {
        tipo: "melhoria",
        texto:
          "Os botões de seção abrem o formulário já preenchido com o que o clique disse: \"Registrar volume\" abre em volume, com o cursor no valor.",
      },
      {
        tipo: "melhoria",
        texto:
          "Quando algo é recusado ao salvar, a mensagem agora diz o motivo e aparece embaixo do campo certo. Cadastrar um projeto com nome repetido dizia apenas \"tente de novo\", e tentar de novo dava igual.",
      },
    ],
  },
  {
    versao: "1.3",
    data: "2026-08-13",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "O sistema agora se chama LVL Airdrops e usa o azul da Level Cripto. A tela de entrada foi redesenhada junto.",
      },
      {
        tipo: "novidade",
        texto:
          "A barra lateral recolhe, e a preferência fica guardada. Suporte, Novidades e Sair passaram para o rodapé dela.",
      },
      {
        tipo: "melhoria",
        texto:
          "A aba do navegador mostra só LVL Airdrops, sem repetir o nome da tela em que você já está.",
      },
      {
        tipo: "melhoria",
        texto:
          "Os realces de mouse e os links passaram para o azul da marca. O verde ficou reservado ao que ele significa: depósito, projeto distribuído e progresso de meta.",
      },
      {
        tipo: "melhoria",
        texto:
          "Depois de cinco senhas erradas seguidas, o acesso àquele e-mail fica bloqueado por quinze minutos. Serve para impedir que alguém descubra uma senha por tentativa e erro.",
      },
      {
        tipo: "correcao",
        texto:
          "Ao pedir uma senha nova pela segunda vez no mesmo dia, o aviso deixava de fora quem não tinha cadastro. Agora a resposta é a mesma para todo mundo, e um endereço qualquer não pode mais ser usado para descobrir quem tem conta aqui.",
      },
    ],
  },
  {
    versao: "1.2",
    data: "2026-08-13",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "Todo campo numérico agora confirma embaixo como o valor foi entendido: dinheiro, pontos e quantidade de token, cada um no seu formato.",
      },
      {
        tipo: "correcao",
        texto:
          "Ao criar tarefa, meta, medição de pontos ou recebimento, apareciam todas as suas carteiras em vez das vinculadas àquele projeto. Só a tela de vincular conta continua mostrando todas, porque é ela que cria o vínculo.",
      },
    ],
  },
  {
    versao: "1.1",
    data: "2026-08-12",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "Editar uma tarefa que se repete falhava com \"não foi possível salvar\". Ao mudar a data de uma tarefa recorrente, as próximas ocorrências passam a ser reagendadas a partir da nova data, e as atrasadas continuam onde estavam.",
      },
      {
        tipo: "novidade",
        texto:
          "Botão de suporte no rodapé: dá para relatar um erro, tirar dúvida ou sugerir algo de qualquer tela. A resposta vai para o e-mail do seu cadastro.",
      },
    ],
  },
  {
    versao: "1.0",
    data: "2026-08-12",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "O volume operado aparece como indicador dentro do projeto, e no cartão da lista sempre que houver volume, não só em projetos de perps.",
      },
      {
        tipo: "novidade",
        texto:
          "Projetos com volume ganham uma aba própria, com o total, o quanto foi operado nos últimos 30 dias, o detalhe por conta e a lista de lançamentos.",
      },
      {
        tipo: "novidade",
        texto:
          "O histórico do projeto pode ser filtrado por tipo de lançamento, mostrando quantos existem de cada.",
      },
    ],
  },
  {
    versao: "0.9",
    data: "2026-08-12",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "Ao gerar uma senha temporária pela lista de pedidos, a janela com a senha sumia antes de dar tempo de copiar.",
      },
      {
        tipo: "melhoria",
        texto:
          "A lista de tarefas mostra apenas a próxima ocorrência de cada tarefa em \"Próximas\", em vez de todas as próximas semanas. Atrasadas e de hoje continuam aparecendo inteiras.",
      },
      {
        tipo: "melhoria",
        texto:
          "O campo de intervalo em dias só aparece quando a repetição é \"a cada N dias\", em vez de ficar sempre na tela.",
      },
    ],
  },
  {
    versao: "0.8",
    data: "2026-08-11",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "Lançamentos do tipo \"Outro\" eram salvos mas não entravam em nenhum cálculo, o que parecia falha ao salvar. Agora contam no saldo e no resultado como os demais.",
      },
      {
        tipo: "melhoria",
        texto:
          "Ao escolher o tipo do lançamento, a tela explica o que ele faz: se entra no saldo, se desconta do resultado ou se é apenas atividade.",
      },
      {
        tipo: "melhoria",
        texto:
          "A data escolhida passa a ser confirmada por extenso, como \"11 de agosto de 2026\", para não haver dúvida entre dia e mês.",
      },
    ],
  },
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
