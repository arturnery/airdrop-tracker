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
 *
 * **Curadoria: `novidade` é o que sustenta esta tela.** Uma correção interna
 * ou um ajuste que ninguém chegou a notar não vira entrada aqui, mesmo que
 * tenha virado commit e linha no DEVLOG — a pessoa lendo `/novidades` está
 * perguntando "o que ganhei", e um histórico cheio de `correcao` que ela
 * nunca percebeu apaga o sinal em meio a ruído, além de sugerir uma ferramenta
 * mais instável do que é. `correcao` só entra quando alguém relatou o defeito
 * (pelo diálogo de suporte ou por fora): aí a entrada fecha o ciclo com quem
 * sentiu o problema. `melhoria` é o meio-termo, para o que refina algo que já
 * existia sem ser função nova nem conserto de relato.
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
    versao: "1.27",
    data: "2026-10-27",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "O Histórico agora mostra cada atualização de pontos e de volume, com quanto mudou desde a medição anterior, e ganhou o filtro Pontos.",
      },
      {
        tipo: "melhoria",
        texto:
          "No ranking de Pontos / Volume, quem mede o projeto em mais de uma conta tem as contas separadas: clique no nome para ver os números de cada uma.",
      },
    ],
  },
  {
    versao: "1.26",
    data: "2026-10-23",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Novo Feed do X, na área Airdrops: os posts dos projetos que a comunidade farma num lugar só, e o perfil de cada projeto para abrir direto no X. O feed aparece para quem está logado no X no navegador.",
      },
    ],
  },
  {
    versao: "1.25",
    data: "2026-10-23",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "Avisos com novo visual: projeto e prazo no topo, os pontos principais em destaque, o alerta contra golpe e os passos numerados. E o compartilhar no X agora vai em duas partes: o anúncio, citando o post oficial do projeto, e logo abaixo a resposta com o convite da comunidade.",
      },
    ],
  },
  {
    versao: "1.24",
    data: "2026-10-23",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Novo mural de Avisos na área Airdrops: os anúncios importantes de cada projeto, com o resumo, o que fazer, o prazo e o link oficial. Dá para compartilhar cada aviso no X.",
      },
    ],
  },
  {
    versao: "1.23",
    data: "2026-10-23",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "O ranking de pontos e volume mostra só os projetos ativos da comunidade (os Farms atuais), para todo mundo. Os projetos que cada um cadastra por conta própria continuam só seus.",
      },
    ],
  },
  {
    versao: "1.22",
    data: "2026-10-21",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Compartilhe no X: nas abas Pontos e Volume de cada projeto, e no resultado quando ele é positivo, um botão abre o X com o post pronto, marcando o projeto e mostrando a sua evolução no período e o convite para a comunidade. Antes de abrir o X, você vê a prévia do post e o lembrete de anexar o print dos seus números.",
      },
    ],
  },
  {
    versao: "1.21",
    data: "2026-10-21",
    mudancas: [
      {
        tipo: "correcao",
        texto: "No celular, as páginas não rolam mais para o lado, e os botões do topo cabem na tela.",
      },
      {
        tipo: "correcao",
        texto:
          "Registrar airdrop aceita vírgula no preço e na quantidade (1,25), e preço de token com muitas casas não é mais arredondado.",
      },
      {
        tipo: "correcao",
        texto: "A aba Volume aparece em todo projeto, então já dá para registrar o primeiro volume.",
      },
      {
        tipo: "melhoria",
        texto:
          "Uma retirada que deixaria a conta negativa no projeto agora avisa antes de salvar, com o saldo atual.",
      },
      {
        tipo: "melhoria",
        texto: "O site do projeto pode ser colado sem https:// (ex.: lighter.xyz).",
      },
      {
        tipo: "novidade",
        texto: "Metas de pontos. E cada meta aparece na unidade dela: só as de volume e saldo em dólar.",
      },
    ],
  },
  {
    versao: "1.20",
    data: "2026-10-21",
    mudancas: [
      {
        tipo: "melhoria",
        texto: "Na área Trade, Sinais agora se chama Operações.",
      },
      {
        tipo: "novidade",
        texto:
          "Você pode entrar numa operação aberta informando o valor em dólar. Quando ela fechar, o seu resultado em dólar aparece no card e em Resultados, somado com o das outras operações em que você entrou.",
      },
    ],
  },
  {
    versao: "1.19",
    data: "2026-10-21",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Novo Ranking na área Airdrops, com dois rankings: o resultado de cada membro, com os últimos airdrops recebidos, e os pontos e o volume de cada um por projeto. Todos aparecem; quem preferir manter os números só para si pode sair em Perfil.",
      },
    ],
  },
  {
    versao: "1.18",
    data: "2026-10-21",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Projetos agora tem duas abas no menu: Todos os projetos, com os farms atuais para adicionar e os seus projetos pausados, em estudo ou já distribuídos; e Farmando agora, só com o que você está farmando, mostrando depositado, exposição, resultado e ROI em cada card. Para tirar um projeto do farm, você diz o motivo. Quando um farm atual muda de status (por exemplo, foi distribuído), o seu card avisa e você decide se atualiza.",
      },
    ],
  },
  {
    versao: "1.17",
    data: "2026-10-20",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Sinais de trade agora podem ser fechados: escolha se bateu um alvo, stopou, saiu em outro preço ou não acionou, e o lucro ou prejuízo é calculado sozinho. Os fechados vão para a nova aba Resultados, com a taxa de acerto e o resultado somado em R. Quem quiser pode ver também em dólar, informando quanto arrisca por operação ou o tamanho da posição.",
      },
    ],
  },
  {
    versao: "1.16",
    data: "2026-10-19",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Nova área Trade no menu, com os sinais de operação em cards: ativo, compra ou venda, entrada (ou zona de entrada), stop e alvos, com o risco/retorno de cada alvo. Quem publica pode colar o print da operação e a IA preenche o sinal para conferência. Sinal novo acende um sininho no item Sinais do menu e é avisado no canal do Discord.",
      },
    ],
  },
  {
    versao: "1.15",
    data: "2026-10-19",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "Os grupos do menu lateral (Airdrops, Comunidade) podem ser recolhidos pela setinha ao lado do título. O site lembra a sua escolha, e um grupo recolhido continua mostrando a página em que você está.",
      },
    ],
  },
  {
    versao: "1.14",
    data: "2026-10-15",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "Projeto sem nenhuma conta vinculada agora avisa: no card da tela de Projetos e no topo da página do projeto, com um botão para vincular a conta ali mesmo. Todo projeto precisa de pelo menos uma conta, porque é ela que recebe os lançamentos, as tarefas e os pontos.",
      },
    ],
  },
  {
    versao: "1.13",
    data: "2026-10-14",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "Os cards da tela de Projetos mostram atalhos para os links de cada projeto (site, vídeo tutorial, docs, X e Discord), só os que estiverem preenchidos. Um clique abre o link numa aba nova, sem precisar entrar na página do projeto. Os cards também ficaram padronizados: mesmo tamanho, nome e inicial do projeto em destaque no topo, selos logo acima da linha de separação e o rodapé sempre na base.",
      },
    ],
  },
  {
    versao: "1.12",
    data: "2026-10-14",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Projetos ganharam o campo Vídeo tutorial, nas informações do projeto. Quando preenchido, um ícone do YouTube aparece ao lado do nome, na página do projeto, e abre o vídeo direto.",
      },
    ],
  },
  {
    versao: "1.11",
    data: "2026-10-14",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Nova área Comunidade no menu, separada da de airdrops, começando pelo calendário de lives da Level Cripto: a grade do mês, de domingo a sábado, com horário, apresentador e tema de cada live, as que se repetem toda semana ou a cada duas semanas e o evento especial em destaque. Clique numa live para ver a descrição e o link. O menu agora divide as áreas em grupos.",
      },
      {
        tipo: "correcao",
        texto:
          "No Lançar com IA, uma frase como \"registrar recebimento Solstice 75 dólares\" abria um lançamento de rendimento, em vez do registro de airdrop recebido. Agora \"recebimento\", \"airdrop\" e \"claim\" abrem o formulário de recebimento, e o valor entra nos airdrops ganhos.",
      },
      {
        tipo: "melhoria",
        texto:
          "Na página de um projeto, o nome no topo abre o site dele numa aba nova, quando o site estiver cadastrado nas informações do projeto.",
      },
    ],
  },
  {
    versao: "1.10",
    data: "2026-10-13",
    mudancas: [
      {
        tipo: "melhoria",
        texto:
          "O Lançar com IA passou a entender também pontos, volume e airdrop recebido, e abre o formulário certo de cada um. \"Ganhei 300 pontos na Lighter\" ou \"fiz 20 mil de volume hoje\" viram o total acumulado, somado à sua última medição, com um aviso dizendo a base usada. \"Caiu o airdrop da Solstice, 3.000 SLX a $0,12\" abre o registro de recebimento, que antes era confundido com rendimento.",
      },
    ],
  },
  {
    versao: "1.9",
    data: "2026-10-06",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Lançar com IA, na Visão geral. Escreva o que aconteceu do jeito que contaria para alguém (\"depositei $100 na Lighter, conta X, para estratégia DN\") e o formulário de lançamento abre já preenchido com projeto, conta, tipo, valor, data e descrição. Nada é salvo antes de você conferir: o que a IA não conseguiu decidir fica em branco, com um aviso dizendo o quê. Uma frase pode ter mais de um lançamento (\"tirei $70 da Lighter e depositei na Variational\" são uma retirada e um depósito): eles abrem um depois do outro para conferir.",
      },
    ],
  },
  {
    versao: "1.8",
    data: "2026-09-04",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "Catálogo de projetos da comunidade. Quem administra pode destacar um projeto que já farma, com um resumo curto, e ele passa a aparecer para todo mundo na tela de Projetos, com um botão de adicionar ao próprio portfólio. Adicionar copia os dados para um projeto seu: editar ou apagar depois não muda o que aparece no catálogo, e o catálogo mudar depois não muda o que você já adicionou.",
      },
    ],
  },
  {
    versao: "1.7",
    data: "2026-09-02",
    mudancas: [
      {
        tipo: "correcao",
        texto:
          "A data que os formulários ofereciam ficava parada no dia em que a tela tinha sido aberta. Com a aba aberta de um dia para o outro, tudo o que você lançasse saía com a data de ontem, e o campo aparecia preenchido e plausível. Agora o dia vira sozinho na tela, sem precisar recarregar.",
      },
      {
        tipo: "novidade",
        texto:
          "Medição de volume, medição de pontos, progresso de meta e recebimento de airdrop ganharam botão de editar. Antes só dava para apagar e lançar de novo, o que em volume e pontos mudava o ganho do período seguinte: apagar a medição do meio faz a próxima passar a ser comparada com outra.",
      },
      {
        tipo: "melhoria",
        texto:
          "No recebimento de airdrop dá para trocar entre \"quantidade e preço\" e \"só o total em dólar\" ao editar. Quem lançou o total e depois descobriu a quantidade exata completa o registro sem refazê-lo, e o valor em dólar é recalculado.",
      },
      {
        tipo: "melhoria",
        texto:
          "A quantidade de token deixou de aparecer com dezoito zeros depois da vírgula. 3078 em vez de 3078,000000000000000000.",
      },
    ],
  },
  {
    versao: "1.6",
    data: "2026-08-26",
    mudancas: [
      {
        tipo: "novidade",
        texto:
          "O volume agora funciona como os pontos: você registra o total acumulado que a plataforma mostra, e o sistema calcula quanto rodou desde a medição anterior. Antes era preciso lançar o incremento, fazendo a subtração de cabeça. Seus lançamentos antigos foram convertidos em medições, e o total de cada projeto continua o mesmo.",
      },
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

/**
 * Quantas mudanças a pessoa ainda não viu, para o selo no rodapé.
 *
 * Conta itens (`mudancas`), não versões: uma versão que empacotou três
 * mudanças deveria pesar três, não uma, no aviso. `versaoVista` nula conta
 * como "nunca abriu `/novidades`", e tudo é não visto.
 *
 * Se a versão guardada não existe mais no changelog (o que só aconteceria
 * apagando uma versão já publicada, algo que a regra de curadoria acima não
 * prevê fazer), o retorno é como se nada tivesse sido visto: superestimar é
 * seguro aqui, o pior caso é a pessoa abrir `/novidades` à toa.
 */
export function contarNovidadesNaoVistas(versaoVista: string | null): number {
  const indice = changelog.findIndex((v) => v.versao === versaoVista);
  const naoVistas = indice === -1 ? changelog : changelog.slice(0, indice);
  return naoVistas.reduce((total, v) => total + v.mudancas.length, 0);
}
