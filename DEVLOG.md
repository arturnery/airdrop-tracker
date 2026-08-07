# Diário de desenvolvimento

Registro cronológico das decisões, dos problemas encontrados e do raciocínio por trás de
cada escolha. O [`ARCHITECTURE.md`](ARCHITECTURE.md) diz **como o sistema é**; este
documento diz **como se chegou até ele**: incluindo o que foi descartado e o que deu
errado no caminho.

---

## Marco 0: Arquitetura antes de qualquer código

**Ponto de partida:** uma planilha do Google Sheets com as colunas
`Data | Projeto | Conta/Wallet | Ação Realizada | Valor | Status`.

### Três problemas estruturais na planilha

Antes de propor solução, o diagnóstico do que estava errado no modelo atual:

1. **Conta era texto solto.** `chrome (Perfil 1)`, `brave` e `mbox` eram redigitados a
   cada linha. Sem a entidade "conta", era impossível responder *"quanto essa carteira
   tem espalhado entre todos os projetos?"*: uma pergunta central para quem farma com
   múltiplas contas.

2. **Depósito e saldo dividiam a mesma coluna.** `Depósito na Plataforma` é um evento de
   fluxo (somável); `Saldo Atualizado` é uma foto do saldo (não somável). Somar a coluna
   de valor misturava dinheiro que entrou com dinheiro que já estava lá: **o total da
   planilha estava simplesmente errado**. Esta virou a correção central do modelo:
   `transactions` e `balance_snapshots` são tabelas separadas.

3. **`Status: Pendente` significava duas coisas.** Ora "não executei essa ação" (tarefa),
   ora "o airdrop não caiu" (estado do projeto). Conceitos distintos precisam de tabelas
   distintas.

### Escolha de stack

O critério não foi apenas técnico. O CV já listava Next.js sem nenhum projeto que
comprovasse, e o projeto anterior (landing page com captação de leads) usava
`Vite + Express + tRPC`. Repetir a mesma stack não adicionaria nada ao portfólio.

**Decisão:** Next.js 16 (App Router) + Drizzle + Neon + Zod + Tailwind/shadcn + Vitest.
Mantém 80% do que já era dominado: só a camada de servidor muda, de `Express + tRPC`
para `Server Components + Server Actions`. Risco de execução baixo, skill nova
comprovada.

**Descartado:** manter tRPC dentro do Next. tRPC resolve type-safety entre cliente e
servidor separados; no App Router, Server Actions já são type-safe por construção. As
duas camadas se sobreporiam sem ganho.

### Revisão da própria arquitetura

Ao revisar o documento para aplicar duas melhorias pedidas, **quatro furos apareceram no
que eu mesmo tinha escrito**:

| Furo | Consequência se tivesse ficado |
|---|---|
| `account_id` nullable nas tabelas de movimento | Linhas órfãs somando no total do projeto sem aparecer na tabela conta-por-conta; os dois números nunca fechariam |
| FKs independentes para projeto e conta | Nada impediria registrar dinheiro numa conta jamais vinculada àquele projeto |
| Meta `volume_usd` sem fonte de dados | Métrica que nunca atualizaria: volume de trading não se deriva de depósito |
| Faltava `server-only` na camada de dados | Um import errado num Client Component empacotaria a `DATABASE_URL` no bundle do navegador |

Corrigidos com: `NOT NULL`, FK composta apontando para `project_accounts`, tipo
`volume_traded` + tabela `goal_entries`, e `import "server-only"` obrigatório em `db/`.

**Lição registrada:** revisar arquitetura escrita por si mesmo, com algum distanciamento,
encontra o que a escrita original não vê. Três revisões antes da primeira linha de código.

---

## Marco 1: Fase 0: infraestrutura

Setup do projeto: Next.js, TypeScript strict, Drizzle, Neon, Tailwind, shadcn, Vitest.

### Versões reais divergiram do planejado

O documento dizia "Next.js 15"; a versão atual era **16.2.12**. Também Zod 4 (API de
validação de string mudou) e Tailwind 4 (configuração por CSS, sem `tailwind.config.js`).
A arquitetura foi atualizada com as versões instaladas em vez de manter a ficção do
planejamento.

### A guarda `server-only` foi testada, não assumida

Documentar "isso protege contra X" sem verificar é como não ter proteção. Criei
temporariamente um Client Component importando o banco e rodei o build:

```
'server-only' cannot be imported from a Client Component module
  ./lib/env.ts → ./db/index.ts → ./app/probe/probe.tsx [Client Component Browser]
```

Falhou como devia, com o rastro completo do import. A sonda foi removida depois.

**Erro cometido no caminho:** a primeira tentativa usou a pasta `app/_probe/`. Pastas com
`_` são privadas no Next e não viram rota: a página nunca foi compilada e o build passou,
dando a falsa impressão de que a proteção não funcionava. Renomear para `app/probe/`
revelou o comportamento real.

### `money.ts`: os testes encontraram dois bugs meus

Aritmética monetária em centavos inteiros: valor em dinheiro nunca passa por float. Ao
escrever os testes, dois defeitos apareceram:

1. **`"1.2.3,4,5"` era aceito como válido.** Faltava validar agrupamento de milhar.
   Corrigido com regex de grupos exatos de 3 dígitos.

2. **`"10.005"` é genuinamente ambíguo**: dez mil e cinco (milhar brasileiro) ou dez com
   três casas decimais? Não há como desambiguar sem quebrar `"1.234"`, que precisa valer
   mil duzentos e trinta e quatro no teclado BR.

   **Decisão:** interpretar como milhar, documentar na função e travar com um teste que
   explica o porquê:

   ```ts
   it("resolve o caso ambíguo de 3 dígitos como milhar", () => {
     expect(parseUserInput("10.005")).toEqual({ ok: true, value: 1_000_500 });
   });
   ```

   Se alguém mudar a heurística, o teste quebra e força uma decisão consciente em vez de
   uma mudança acidental.

---

## Marco 2: Front completo com dados de desenvolvimento

Pedido: construir a interface antes do backend, para avaliar o produto antes de investir
no banco.

### A regra que impediu retrabalho

Dados mock atrás da **mesma interface** que as queries reais teriam:

- `db/queries` devolve os view models de `lib/types`, com assinatura `async`;
- as fixtures reproduzem o formato do Drizzle: `numeric` como **string**, data como
  `"YYYY-MM-DD"` sem timezone.

A agregação já opera sobre o formato real. Trocar fixture por SQL não muda a lógica.

### Decisão de produto: exposição estimada vs. confirmada

Um par projeto×conta pode não ter nenhum snapshot de saldo (foi aportado hoje, por
exemplo). Três opções:

| Tratamento | Problema |
|---|---|
| Contar como zero | Prejuízo fictício de 100% em todo projeto recém-aportado |
| Assumir igual ao aporte, sem avisar | Falsa precisão |
| **Estimar pelo aporte e propagar a incerteza** | Escolhido |

A função devolve `confirmed: false`, e a interface mostra *"10 de 11 contas com saldo
confirmado"* mais um alerta de que o resultado é otimista. **A honestidade sobre a
incerteza fica visível, não escondida.**

### Dados reais expuseram uma inconsistência real

Nas transcrições da planilha, `Meridian / navegador` tem dois snapshots de saldo e **nenhum
depósito registrado**. A interface mostra o saldo sem aporte em vez de corrigir ou
esconder: é informação legítima para o dono decidir o que fazer.

### Acessibilidade medida, não estimada

- Contraste de todos os tokens calculado contra as duas superfícies: pior caso **6.63:1**,
  acima do mínimo AA de 4.5:1.
- **Bug encontrado:** a navegação estava duplicada no DOM (uma cópia para mobile, outra
  para desktop), fazendo leitor de tela anunciar dois menus idênticos. Unificada em um
  único `<nav>` com classes responsivas.

### Gráfico: série única recebe cor única

O gráfico de capital por projeto usa **uma cor só**. Pintar cada projeto de um tom
diferente seria decoração: a identidade já vem do rótulo de texto. O valor aparece
escrito ao lado, então nada depende de enxergar cor ou comprimento. Construído em CSS
puro: acessível por construção e sem biblioteca no bundle.

---

## Marco 3: Formulários em modo local

Pedido: poder cadastrar dados para testar, ainda sem backend.

### Bug relatado: "nos projetos, ao clicar não entra no projeto"

**Diagnóstico:** apenas o texto do nome era link. Clicar em qualquer outro ponto do card
não fazia nada.

**Correção:** *stretched link*: o `<Link>` continua sendo um único link real (bom para
teclado e leitor de tela), mas seu `::after` cobre o card inteiro. Envolver o card no
`<Link>` aninharia os links internos, o que é HTML inválido.

### Refatoração que evitou jogar trabalho fora

Para os formulários funcionarem localmente sem descartar a arquitetura, a agregação saiu
de `db/queries` para `lib/selectors` como funções puras:

```
(Dataset, hoje) → view model
```

Nenhuma sabe se o `Dataset` veio do localStorage ou do Postgres. O mesmo código serve os
dois modos, e `db/queries/index.ts` ficou como ponto de retorno explícito.

### O linter apontou um erro real

Escrevi `setState` dentro de `useEffect` para ler o localStorage após a hidratação. A
regra `react-hooks/set-state-in-effect` do React Compiler acusou renderização em cascata.

**Silenciar seria mais rápido e pior.** Reescrito com `useSyncExternalStore`, que é o
mecanismo do React para ler sistema externo: `getServerSnapshot` entrega as fixtures que
o servidor renderizou, `getSnapshot` entrega o localStorage. Sem divergência de hidratação
e sem render extra.

---

## Marco 4: Edição e exclusão

### Bug relatado: "todos os botões verdes não estão funcionando"

**Diagnóstico:** o componente do botão primário não repassava as props recebidas.

```tsx
function BotaoNovo({ children }) {        // ← descarta as props
  return <Button size="sm">…</Button>
}
```

`DialogTrigger asChild` clona o elemento e injeta `onClick` **nas props**: que iam para
o lixo. Os botões *outline* funcionavam por usarem `<Button>` direto, o que explicava
exatamente por que só os verdes falhavam. Um `{...props}` corrigiu as cinco chamadas.

**Lição:** um componente que envolve outro e não faz spread de props quebra silenciosamente
qualquer padrão `asChild`.

### Segundo erro meu, pego na revisão

O gatilho de exclusão tinha sido escrito como `<span onClick>`: não alcançável por Tab.
Trocado por `AlertDialogTrigger asChild` sobre um `<button>` real.

### Exclusão em cascata: decisões de produto

Replicando o que as FKs fariam no banco, com duas escolhas que não são óbvias:

- **Desvincular conta de um projeto** remove só os movimentos daquele par. Tirar `chrome`
  de um projeto não mexe no `chrome` de outro.
- **Apagar uma conta** converte suas tarefas específicas em tarefas de todas as contas,
  em vez de apagá-las. A intenção de farming sobrevive à conta.

A confirmação informa o tamanho do estrago: *"isso também apaga 8 lançamentos e 2
tarefas"*: em vez de um "tem certeza?" genérico, já que não há desfazer por item.

### Segunda extração para funções puras

A lógica de cascata tinha nascido dentro do componente React: **impossível de testar**.
Movida para `lib/mutations` como `(Dataset, dados) → Dataset`. O provider caiu para uma
casca fina de delegação, e entraram 17 testes que antes não existiam: incluindo um que
garante que nenhuma mutação altera o dataset original.

São as mesmas transformações que as Server Actions vão executar contra o Postgres. O teste
que diz "apagar um projeto faz o total cair de $242 para $142" continua valendo depois da
migração.

---

## Marco 5: Histórico, categoria e filtros

### Histórico: feed derivado, não tabela de auditoria

Duas abordagens possíveis:

| | Feed derivado (escolhido) | Tabela de auditoria |
|---|---|---|
| Fonte | Os próprios registros | Gravação de cada ação |
| Alcance | Funciona sobre todo o histórico existente | Só vale a partir do dia em que existe |
| Mostra | O que foi feito | Também quem editou e apagou |
| Custo | Zero tabelas novas | Tabela + escrita em toda mutação |

Escolhido o derivado, com a limitação declarada em código e ao usuário: mostra **o que
foi feito**, não **o que foi editado**.

### Categoria de projeto

`Liquidez (farm passivo)` · `Interações semanais` · `Perps`: classificação por **tipo de
esforço**, que é o que determina a rotina de trabalho.

### Filtros: contagem vem do conjunto completo

Detalhe de usabilidade decidido de propósito: os contadores dos chips refletem o total,
não o resultado filtrado. Se viessem do filtrado, escolher "Perps" faria as outras
categorias mostrarem 0: e o usuário perderia a referência de quantos existem. Filtros que
não devolveriam nada são escondidos em vez de oferecidos.

---

## Marco 6: Modelo de perfis compartilhados

Contexto: a ferramenta será aberta para a comunidade, cada pessoa com seu perfil,
podendo **ver** o perfil dos outros mas não editar.

### Audit log descartado: com justificativa

Eu havia sugerido reservar espaço para uma tabela de auditoria. O usuário apontou que
cada pessoa só altera os próprios dados.

**Ele estava certo.** Se só o dono escreve nos próprios registros, o autor de qualquer
alteração é sempre o dono: `user_id` já responde "quem". Auditoria só faria sentido com
várias pessoas editando o mesmo perfil. Descartado.

### O que o compartilhamento realmente exige

Uma distinção que o modelo de dono único não tinha:

| | Significado |
|---|---|
| **viewer** | quem está com a sessão aberta |
| **owner** | de quem são os dados exibidos |

Hoje `db/queries` assume que coincidem. Na fase 7 passa a receber `ownerId` e consultar
permissão: a mudança de maior alcance da fase de backend, registrada antes de começar.

### Duas armadilhas registradas

1. **Esconder botão não é autorização.** Um perfil em modo leitura que só oculta botões
   continua editável por quem souber montar a requisição. A recusa que vale é a da Server
   Action.
2. **Campo escondido não é campo filtrado.** Valor que não pode ser visto não pode sair da
   query e ser ocultado por CSS: estaria no HTML, legível no inspetor.

### Rótulo de conta separado de endereço de carteira

O usuário marcou "contas e carteiras" como visível. Separei em duas chaves porque os
riscos são diferentes:

- **Rótulo** (`chrome (Perfil 1)`) comunica a estratégia multi-conta. É o conteúdo útil
  para a comunidade, sem custo.
- **Endereço** (`0x…`) permite ler todo o histórico on-chain e, o mais grave,
  **correlacionar as contas entre si**. Vários projetos usam análise de cluster para
  desqualificar farming multi-conta: publicar os endereços juntos entrega o agrupamento
  pronto. Não é só privacidade: pode custar os airdrops.

`show_wallets` nasce desligado e exige ato explícito. A decisão continua do usuário, mas
não fica embutida numa escolha única.

---

## Marco 7: Programas de pontos e descrição nos saldos

Dois pedidos: acompanhar os programas de pontos (para uma live semanal com a comunidade,
mostrando a evolução do acúmulo) e um campo de descrição ao registrar saldo.

### A armadilha resolvida antes de codar

O pedido foi *"igual tem do capital, coloque uma parte de pontos"*, o que sugeriria
espelhar a estrutura do dinheiro: inclusive um indicador de total.

**Não funciona.** Mil pontos de um projeto e mil de outro são unidades diferentes; somá-los
é como somar moedas sem câmbio. O total geral seria um número sem significado exibido com
aparência de precisão.

**Decisão:** agregação só **dentro** do projeto, entre suas contas. Entre projetos, o que
se compara é a **variação**, não o acumulado. A interface não tem, em lugar nenhum, um
indicador de "total de pontos".

### Aritmética própria em vez de reaproveitar `money.ts`

Reusar `Cents` teria sido menos código, com três problemas:

| | Dinheiro | Pontos |
|---|---|---|
| Escala | 2 casas | 4 casas, valores maiores |
| Unidade | única (USD) | uma por projeto |
| Entra em P&L | sim | **nunca** |

O terceiro item decidiu: com tipos separados, somar ponto com dinheiro é **erro de
compilação**. Compartilhando o tipo, seria um bug silencioso esperando acontecer.

### Modelo: foto, não extrato

Programas de pontos exibem um acumulado ("você tem 12.450 pontos"), não um histórico de
ganhos. Então o modelo é o mesmo dos saldos em dólar: registra-se o total do dia, e o
ganho do período é a diferença entre duas medições.

**Detalhe que exigiu cuidado:** as contas nem sempre são medidas no mesmo dia. Comparar
"total de hoje" com "total de uma semana atrás" misturaria contas medidas em momentos
diferentes. A variação é calculada **conta a conta** e só depois somada.

Também: um programa com uma única medição devolve variação `null`, não zero: exibir
"+0" na estreia sugeriria estagnação onde só falta base de comparação.

### O teste encontrou outro bug de parsing

`parsePointsInput("1.5,5")` era aceito como 15,5. O parser separava inteiro e decimal
corretamente mas não validava o **agrupamento de milhar** da parte inteira: `"1.5"` não
é agrupamento válido, porque milhar exige grupos de exatos 3 dígitos.

É exatamente o mesmo defeito que `money.ts` teve no Marco 1, cometido de novo em código
novo. Corrigido com a mesma validação de agrupamento.

**Lição:** ao escrever um segundo parser com regra parecida, revisar os casos-limite que o
primeiro já resolveu: a memória de ter corrigido não impede repetir.

### Descrição nos saldos

O campo `note` já existia no schema documentado, mas não no formulário. Ao registrar um
saldo, agora se explica **o que mudou** em relação ao anterior: "rendimento do DeFi",
"perda no trade", "migrado do capital de farm".

A nota aparece no histórico do projeto e no feed de atividade, substituindo o rótulo
genérico "Saldo atualizado" quando existe. Um saldo que caiu passa a dizer por quê.

### Correção: o risco estava no lugar errado

Projeto com status `descartado` aparecia com a **palavra "Descartado" riscada** dentro do
badge, em vez do nome do projeto. O `line-through` tinha ido parar no estilo do rótulo:
o que, além de não comunicar nada, deixava o próprio rótulo difícil de ler.

O risco pertence ao **nome**: é ele que representa a coisa abandonada. Extraído para um
helper `nomeRiscado(status)` aplicado no card, na tabela do dashboard, no cabeçalho e na
trilha do projeto, com teste travando o comportamento.

## Marco 8: Livro-razão e aportes em token

Pergunta do usuário: *"qual seria a diferença de registrar saldo para novo lançamento?"*

A dúvida em si já era o diagnóstico. Se quem construiu a rotina não sabe qual usar,
a interface não está comunicando: e essa era a distinção central do modelo.

### A decisão: um só caminho de entrada

Em vez de explicar melhor a diferença, o usuário preferiu eliminá-la: **tudo vira
lançamento**, e o saldo passa a ser a soma deles. A motivação é boa: o histórico passa a
explicar cada centavo, em vez de o saldo aparecer sem origem.

O risco foi apontado antes de executar: **variação não registrada nunca aparece**. Com
foto de saldo, bastava olhar a plataforma e corrigir; com razão puro, é preciso descobrir
o que faltou. Ofereci um tipo "Ajuste de saldo" (digita o total, o sistema grava a
diferença) como meio-termo, e o usuário optou pelo modelo puro, ciente da contrapartida.

Consequências no código:

- `balance_snapshots` desapareceu do modelo, das telas e dos testes;
- entrou o tipo `yield` (rendimento): era o caso de uso concreto: *"dia 15 olhei e rendeu
  $1, adiciono $1 de rendimento"*;
- `exposureForPair` deixou de escolher entre snapshot e estimativa: é soma direta;
- todo o aparato de "cobertura de saldo confirmado" saiu, porque não existe mais saldo
  não confirmado.

### O erro que quase passou na fórmula

Ao reescrever o resumo financeiro, escrevi:

```
resultado = exposição + airdrops − aportado − |taxas|
```

Errado. No razão, a retirada já **reduziu** a exposição por ser um movimento negativo:
mas o dinheiro sacado continua sendo do usuário. Aportar 100 e sacar 30 deixa 70 na
plataforma e 30 no bolso: resultado **zero**, e a fórmula acima diria prejuízo de 30.

```
resultado = exposição + |retirado| + airdrops − aportado − |taxas|
```

A retirada entra duas vezes de propósito. Está comentado no código e travado por teste,
porque parece erro para quem lê rápido.

### Aportes em token

Pedido: *"depositei $100 ou 1 SOL: assim podemos saber se estamos ganhando no valor do
token ou não"*.

Modelo escolhido: cada lançamento pode ter `tokenSymbol` e `tokenAmount` além do valor em
dólar. O dólar fica **congelado na data** (foi o que se aportou); a posição em token é
**revalorizada** pela cotação atual. A diferença entre os dois é exatamente o ganho de
preço.

| | |
|---|---|
| Aportado | $180 (1 SOL a $180, congelado) |
| Exposição | $195 (1 SOL × cotação atual) |
| Resultado | +$15 (+8,3%) |

**Cotação manual, sem API.** O usuário informa o preço em `/cotacoes` e atualiza quando
quiser: tipicamente antes da live semanal. Escolhido em vez de CoinGecko para não
adicionar dependência externa, chave e ponto de falha a um app que roda sem backend.

Duas decisões de honestidade:

- **Token sem cotação não é avaliado a zero nem a preço inventado**: mantém o valor
  aportado e a interface avisa quais símbolos estão pendentes. Subestimar seria tão errado
  quanto chutar.
- **A data da cotação fica visível.** Preço de duas semanas atrás avaliando a posição de
  hoje é pior que nenhum, e só dá para perceber isso se a data estiver à vista.

### O preço unitário estava implícito

Ao testar, o usuário notou: lançando $100 e 2 SOL, em lugar nenhum aparecia que a entrada
foi a $50 por SOL. O dado existia, investido ÷ quantidade, mas nunca era mostrado.

Dois lugares passaram a exibi-lo:

- **No formulário, enquanto digita.** Valor e quantidade ficam no mesmo bloco e o preço
  aparece embaixo em tempo real. Serve de conferência: quem quis lançar 0,2 SOL e digitou
  2 vê "$50 por SOL" onde esperava "$500" antes de salvar.
- **Na posição do projeto**, lado a lado com a cotação atual. "Preço de entrada $180 ·
  Cotação hoje $195" responde de imediato à pergunta que motivou o recurso.

O preço não é campo: continua derivado. Guardá-lo permitiria divergir do valor e da
quantidade se um deles fosse editado depois.

### Por que `fee_gas` saiu do saldo

Aproveitei a reescrita para separar: gas sai do bolso, não da posição na plataforma. Antes
era somado junto; agora entra no resultado como custo, mas não reduz a exposição. Um teste
fixa isso.

## Marco 9: Telas de entrada

Pedido: tela de login. Duas coisas precisaram ser separadas antes de codar.

### Autenticação não é autorização

O usuário justificou a escolha de e-mail e senha assim: *"assim consigo autorizar a
entrada apenas de pessoas que eu quiser"*. A premissa não se sustenta:

| | |
|---|---|
| **Autenticação** | provar que você é você: senha, Google, Discord |
| **Autorização** | decidir se você pode entrar |

Com "entrar com Google" ainda dá para liberar só quem se quer; com e-mail e senha,
qualquer um se cadastra se não houver trava. O que garante "só assinantes" é a trava, não
o método.

Feita a distinção, ele escolheu **cadastro livre com aprovação manual**: e e-mail e senha
seguiram valendo, agora por preferência e não por um controle que não existia.

### A tela que quase não foi feita

Aprovação manual implica um estado entre "cadastrou" e "entrou". Sem tela para ele, a
pessoa se cadastra, tenta entrar, é recusada e conclui que quebrou. `/aguardando-aprovacao`
existe para dizer o que acontece a seguir: e para evitar a mensagem de suporte que viria.

### Decisões de segurança nas telas

- **Recuperação de senha não confirma se o e-mail existe.** A mensagem é sempre "se houver
  conta com esse e-mail, o link chega". Dizer "não encontrado" transformaria a tela num
  verificador de quem tem conta.
- **Senha exige comprimento, não símbolos.** Regra complexa empurra para senha previsível
  ou anotada. O que protege de verdade é hash no servidor e limite de tentativas: ambos
  do backend.
- **`autocomplete` correto** (`email`, `current-password`, `new-password`), para que
  gerenciador de senha funcione. Sem isso, o incentivo é criar senha fácil de digitar.

### O aviso que ficou na tela

As telas validam formato de verdade, mas não verificam credencial: não há servidor. Em
vez de deixar a ambiguidade, cada tela traz uma linha: *"Demonstração: a autenticação
entra na fase de backend"*. Sai junto com a entrada do Auth.js.

Estruturalmente, as rotas foram separadas em dois grupos: `app/(app)` com barra lateral e
`app/(auth)` sem: quem ainda não entrou não tem para onde navegar, e oferecer menu daria
caminhos que terminam em erro de permissão.

### Área de administração

A tela de aprovação (`/membros`) fechou o fluxo. Três decisões de produto nela:

**Ordem por quem espera há mais tempo**, não por cadastro mais recente. Numa fila de
aprovação, o mais antigo é o mais urgente: e é justamente ele que some do topo se a
ordenação for decrescente.

**Recusar pede um motivo**, guardado só para o administrador. Meses depois, "por que
recusei essa pessoa?" é uma pergunta real, e sem a nota a resposta se perde.

**Recusa não apaga.** O registro sai da fila mas fica no histórico: quem foi recusado não
volta como cadastro novo, e dá para reconsiderar com o motivo à vista.

Revogar acesso e reconsiderar uma recusa acabaram sendo a **mesma operação**: devolver
para a fila limpando a decisão anterior. Uma função, dois botões com rótulos diferentes.

A tela também obrigou a registrar um conceito que faltava na arquitetura: **papel**.
Alguém precisa aprovar, e essa pessoa vê e-mails que os demais não veem. `users.role` e a
verificação no servidor entraram no documento (§9.3) antes de existirem no código.

### O primeiro administrador

Pergunta do usuário: *"como eu vou ser o adm, qual seria meu login e senha?"*

Resposta curta: nenhum, ainda: nada é verificado. Mas a pergunta expôs um problema que
precisava ser resolvido antes do backend, não durante.

**A tela de aprovação exige um admin logado.** Se a conta do dono também depender de
aprovação, ninguém entra nunca. É o problema do ovo e da galinha, e ele aparece no
primeiro deploy: tarde demais para improvisar.

Três saídas foram avaliadas:

| Abordagem | Por que não |
|---|---|
| Primeiro cadastro vira admin | Abre uma corrida: quem descobrir a URL antes do dono assume o sistema |
| Promover por SQL na mão | Funciona, mas depende de lembrar o comando e de ter acesso ao banco na hora |
| **`ADMIN_EMAIL` em variável de ambiente** | Escolhida |

O que decidiu: a variável **não é alcançável pela aplicação nem adivinhável**, vale desde
o primeiro deploy (sem janela de exposição) e alterá-la depois **não rebaixa ninguém**:
o papel fica gravado no banco, a variável só atua no momento do cadastro.

**A variável não guarda senha.** Ela diz qual e-mail é o dono; a senha continua sendo
escolhida no cadastro e gravada como hash. O `db:seed` cria a conta com `password_hash`
nulo e não aceita senha por parâmetro: senha em variável de ambiente ou em argumento de
linha de comando termina no histórico do shell.

Junto entraram no schema os campos que a fila de aprovação já pressupunha: `role`,
`status`, `reviewed_at`, `review_note`: e `exigirAdmin()` em `lib/auth.ts`, ainda
lançando erro, para que a guarda exista antes das rotas que vão precisar dela.

## Marco 10: Backend: banco, escrita e sessão

O pedido foi *"cada mudança nos airdrops salva de acordo com a conta logada"*.
Três etapas, cada uma verificável antes da seguinte.

### A aposta arquitetural foi cobrada

Trocar fixtures por Postgres não tocou **nenhuma tela, nenhum selector e nenhuma função de
cálculo**. O único arquivo já existente que mudou foi `app/layout.tsx`, que passou a montar
o `Dataset` a partir do banco; o resto do commit é código novo (a camada de leitura e o
seed). Medido com `git show --stat 7c3c776`: 11 linhas removidas no total.

Isso foi possível porque `carregarDataset()` devolve exatamente a forma que as fixtures
devolviam. Os números conferiram sem ajuste: $337 aportado, $348,18 de exposição, +$11,18
de resultado, porque a mesma função pura calcula os dois.

Foi o retorno da decisão tomada lá no Marco 3, de separar agregação da origem dos dados.
Se as views lessem o banco diretamente, esta etapa teria reescrito o aplicativo inteiro.

### As regras saíram do código para o banco

O que estava em `lib/mutations` migrou para onde é mais difícil burlar:

| Regra | Onde vive agora |
|---|---|
| Cascata ao apagar projeto | `ON DELETE CASCADE` |
| Uma medição de pontos por dia | `unique` + `ON CONFLICT DO UPDATE` |
| Movimento exige par projeto×conta | **FK composta** |
| Reimportar planilha não duplica | `unique(user_id, dedupe_key)` |

A FK composta foi testada de propósito: um `INSERT` de lançamento com projeto e conta
aleatórios foi **recusado pelo banco**. A proteção não depende mais de a aplicação
lembrar de verificar.

`lib/mutations` permaneceu como especificação testada dessas regras, mesmo não sendo mais
o caminho de execução.

### Duas regras em toda Server Action

1. **O `userId` vem da sessão, nunca do formulário.** Aceitá-lo do cliente permitiria
   escrever no espaço de outra pessoa alterando um campo oculto.
2. **Todo `UPDATE` e `DELETE` filtra por `userId` além do id.** Buscar só por id
   significaria que conhecer um uuid alheio basta para alterá-lo.

Um caso exigiu cuidado extra: `project_accounts` não tem `user_id`: pende das duas
pontas. Sem checagem, alguém poderia vincular a própria conta ao projeto de outro
mandando os uuids. Daí o `exigirDono()`.

### O bug que o usuário encontrou testando

Ao criar uma cotação, o campo de preço acusava *"Invalid input: expected string, received
number"*.

**Causa:** o formulário validava no cliente e enviava `resultado.data`: já transformado:
para a Server Action, que validava de novo. Como os schemas convertem string em número
("$3" → 300 centavos), a segunda validação recebia número onde esperava string e recusava
**a própria saída**.

Afetava todo formulário com valor monetário, não só o de cotação.

**Correção:** enviar o objeto bruto. A validação no cliente serve para resposta rápida; a
que vale é a do servidor, e ela precisa receber o dado como o usuário digitou.

Entraram 7 testes que fixam a razão: um schema com `transform` **não é idempotente**, e
validar duas vezes o mesmo dado é sempre erro de desenho. Sem eles, o padrão voltaria no
próximo formulário.

### Autenticação

Auth.js com credenciais, senha em bcrypt (custo 12), sessão em JWT.

Três decisões de segurança que não são óbvias:

- **A recusa de login é sempre igual.** Senha errada, e-mail inexistente e conta não
  aprovada devolvem a mesma mensagem. Distinguir transformaria a tela num verificador de
  quem tem conta.
- **Sem hash, a senha ainda é processada.** Conta criada pelo seed não tem senha; retornar
  imediatamente faria o tempo de resposta revelar quais e-mails existem.
- **Cadastro não revela e-mail já usado.** A resposta é idêntica à de um cadastro novo.

O `status` é verificado no `authorize`, não só na interface: conta pendente não abre
sessão, mesmo com a senha correta.

### Isolamento verificado, não presumido

Criei um segundo usuário aprovado e medi:

```
admin : {"projetos":6,"contas":7,"lancamentos":25}
outro : {"projetos":0,"contas":0,"lancamentos":0}

update cruzado afetou 0 linha(s): esperado 0
```

O último número é o que importa: um `UPDATE` com o id de um projeto do admin e o `user_id`
do outro afeta **zero linhas**. Conhecer o uuid não basta.

### Revertendo a decisão sobre e-mail duplicado

A escolha anterior era não confirmar que um e-mail já tinha conta, para que ninguém
mapeasse os membros testando endereços. Ao usar, o autor concluiu que o custo em confusão
era maior que a proteção: quem tentava recadastrar não entendia o que acontecia.

**Decisão revertida com a contrapartida registrada:** o cadastro agora recusa e-mail já
usado com mensagem explícita. O formulário passa a confirmar se um endereço tem conta, o
que é aceitável para uma comunidade fechada e pequena, e deve ser revisto se o cadastro
um dia ficar aberto a público amplo.

Uma exceção precisou ficar de pé: a conta semeada por `db:seed` existe **sem senha**, e é
o cadastro que a define. Recusar todo e-mail existente tornaria o primeiro acesso do
administrador impossível. A regra passou a olhar o hash, não a existência: sem senha,
completa o registro; com senha, recusa.

Junto veio uma correção de cor. O aviso estava em verde, e verde comunica acerto: ali é
bloqueio. Erro passou a vermelho e subiu para cima do formulário, onde quem foi recusado
vê antes de mexer nos campos de novo. As faixas informativas ficaram em tom neutro, para
que a cor signifique alguma coisa quando aparecer.

### Recuperação de senha sem serviço de e-mail

O usuário notou que a tela de "esqueci minha senha" prometia um link que nunca sairia:
não há serviço de envio configurado. Prometer o que não se entrega é pior que não
oferecer.

Três saídas foram avaliadas. Configurar Resend resolveria de vez, mas exige conta,
verificação de domínio e mais uma chave de API. Remover a tela deixaria quem esquece a
senha sem saída alguma.

**Escolhida: o administrador redefine pela área de membros.** Gera uma senha temporária,
mostrada uma única vez num diálogo, e entrega pelo canal em que a comunidade já conversa.
Para um grupo em que as pessoas se conhecem, isso é mais confiável que um link por e-mail
que pode cair no spam.

Dois cuidados na implementação:

- **A senha aparece só uma vez.** O banco guarda apenas o hash, então não há como
  consultá-la depois; se sumir da tela antes de ser copiada, gera-se outra. A interface
  diz isso em vez de deixar a pessoa descobrir.
- **Não redefine senha de outro administrador.** O `UPDATE` exclui `role = 'admin'`, para
  que ninguém assuma a conta de quem administra.

O alfabeto da senha exclui caracteres que se confundem ao ditar (`0`/`O`, `1`/`l`/`I`) e
usa blocos separados por hífen. Quem recebe precisa conseguir digitar.

A tela pública passou a dizer a verdade: o envio automático não está ativo, e o caminho é
pedir no grupo.

### O aviso que existia mas ninguém via

Na mesma rodada, o usuário relatou que cadastrar com e-mail existente não avisava nada.
O log mostrou que o redirecionamento acontecia e a mensagem era renderizada: ela estava
no subtítulo, em cinza pequeno, e passou despercebida.

Virou faixa destacada acima do formulário. **Informação correta em lugar que ninguém olha
equivale a não ter informação**, e a única forma de descobrir isso é ver alguém usar.

### Perfil: fechando o ciclo da senha

A redefinição pelo administrador criou um buraco: quem recebia a senha temporária não
tinha como trocá-la. O autor propôs uma aba de perfil, acessada pelo próprio nome na
barra lateral.

**Nome e senha ficaram em formulários separados.** Trocar o nome não deveria exigir
digitar senha, e salvar a senha não deveria arrastar uma alteração de nome sem querer.
Cada um confirma o que fez, isolado.

Três decisões na troca de senha:

- **Pede a senha atual, mesmo com a sessão aberta.** Sem isso, quem sentasse num
  computador destravado assumiria a conta trocando a senha, e o dono perderia o acesso
  sem entender o motivo.
- **Recusa senha nova igual à atual.** É o erro provável de quem recebeu uma temporária:
  digitar a mesma nos três campos e achar que trocou. Um teste fixa a regra.
- **A sessão continua valendo depois da troca.** Ela foi aberta por quem acabou de provar
  saber a senha atual; derrubá-la só faria a pessoa entrar de novo, sem ganho.

Os campos de senha são limpos após salvar, para não ficarem preenchidos na tela.

Na barra lateral, o peso visual se inverteu: a marca virou a linha discreta de cima e o
nome ganhou tamanho e espaço, porque é o dado da pessoa e agora é clicável. O e-mail
aparece no perfil desabilitado, com a explicação de onde trocá-lo, em vez de simplesmente
não existir na tela.

## Marco 11: Três defeitos achados em uso real

Os três vieram do mesmo lugar: usar o sistema com dados de verdade, depois de o banco
entrar. Nenhum deles aparece em teste unitário, e vale registrar por quê.

### O nome trocado que não trocava

Trocar o nome no perfil salvava no banco, mas a barra lateral seguia com o antigo até
sair e entrar de novo.

A causa é o desenho da sessão. Ela é um JWT assinado no login: os dados vão dentro do
token, não são consultados a cada requisição. Isso é o que torna a sessão barata em
serverless, e foi uma escolha deliberada. O efeito colateral é que **tudo que está no
token congela no instante do login**. `revalidatePath` re-renderizou o layout, mas o
layout lia `sessao.nome`, e a sessão continuava a mesma.

A correção separa duas coisas que estavam juntas:

| Dado | De onde vem | Por quê |
|---|---|---|
| `id`, `papel` | Token | Precisa ser confiável e não pode custar uma consulta por requisição |
| Nome, e-mail exibidos | Banco | São exibição, mudam, e ler errado é pior que ler devagar |

O que decide acesso continua no token, assinado. O que é só exibição passou a vir de
`carregarUsuario()`. Reemitir o token na troca do nome resolveria o sintoma, mas
manteria a armadilha para o próximo campo editável.

### A tarefa que nascia invisível

Criar tarefa deixando "Conta" em branco não adicionava nada. O relato mencionava um
projeto com uma conta só, o que tornava o comportamento ainda mais estranho: em branco
significa "todas as contas", e havia uma.

O banco mostrou o real:

```
contas: 1  |  projetos: 5  |  vinculos: 0  |  tarefas: 6  |  ocorrencias: 2
```

`vinculos: 0`. A tarefa resolvia o alvo consultando `project_accounts`, mas **esse
vínculo só nasce no primeiro lançamento** (`garantirVinculo` é chamada por lançamento,
pontos e recebimento, nunca na criação do projeto). Projeto recém-criado tem zero
vínculos, então "todas as contas do projeto" resolvia para lista vazia, e o `if` que
protegia contra inserir vazio pulava a criação em silêncio.

A tela lista **ocorrências**, não tarefas. Sem ocorrência, a tarefa existia no banco e
não aparecia em lugar nenhum: nem para ser apagada. Cinco delas tinham se acumulado.

Três correções, e a terceira é a que importa:

1. Sem vínculo nenhum, o alvo cai para todas as contas da pessoa. Antes de existir
   lançamento, "todas as contas do projeto" e "todas as minhas contas" são a mesma coisa.
2. Alvo vazio agora **recusa** a criação com mensagem, em vez de criar registro invisível.
   Falhar em silêncio foi o que transformou um caso de borda em cinco registros órfãos.
3. A decisão saiu da Server Action para `lib/tarefas.ts`, como função pura. Dentro da
   action ela só era testável com um banco de verdade, e por isso não tinha teste nenhum.
   São seis agora, incluindo o caso que quebrou.

Um script de reparo (`scripts/reparar-tarefas-sem-ocorrencia.ts`) criou as ocorrências
que faltavam. Ele não apaga nada: torna visível o que já existia e devolve a decisão para
quem usa.

O aviso do formulário também mudou. Havia um texto fixo, "Em branco = vale para todas as
contas do projeto", visível o tempo todo e ignorado justamente por isso. Saiu, e no lugar
entrou um aviso que só aparece quando o campo está em branco, dizendo o número real:
"a tarefa será criada na sua única conta" ou "para todas as 3 contas". Aviso que aparece
sempre vira parte do cenário.

### O check que demorava

Marcar tarefa concluída levava um tempo perceptível para pintar. Não era defeito de
lógica, era o custo real do caminho: escrever no banco, revalidar cinco rotas, recarregar
o dataset inteiro e só então re-renderizar. Todo o resto do sistema tem formulário e
diálogo que fecha, o que disfarça a espera. O check é um clique só, sem nada entre o dedo
e o resultado.

`useOptimistic` pinta na hora e deixa o servidor confirmar depois. Se a escrita falhar, o
React descarta o palpite sozinho e a tela volta ao que o banco diz.

O detalhe que vale a pena: a transformação otimista é `alternarOcorrencia` de
`lib/mutations.ts`, **escrita meses antes, quando os dados eram locais**. Por ser uma
função pura de `(Dataset, id) => Dataset`, sem saber de onde os dados vêm, serviu sem
uma linha de alteração. A mesma propriedade que fez a troca de fixtures por Postgres
custar um arquivo pagou de novo aqui.

---

### Subida em produção

Duas coisas apareceram só na hora de subir, e nenhuma delas dava sinal em desenvolvimento.

`lib/env.ts` valida as variáveis de ambiente na inicialização e **falha o processo** se
alguma faltar. A intenção é boa: melhor recusar a subir com mensagem clara do que deixar
um `undefined` viajar até a string de conexão. Só que a lista ainda exigia `SEED_USER_ID`,
que existia para fixar um dono enquanto não havia login. Com sessão real, só os scripts de
seed a usam, e eles leem `process.env` direto. A validação estava protegendo a aplicação
de uma variável que a aplicação não lê. Saiu do schema.

A lição é sobre validação de ambiente em geral: ela precisa ser revisada quando o motivo
de uma variável existir desaparece, senão vira um obstáculo herdado.

O segredo de sessão de produção foi gerado novo, diferente do de desenvolvimento. Reusar o
mesmo faria um token assinado na máquina local valer no ambiente público.


---

## Marco 12: Separação entre produção e desenvolvimento

Até aqui os dois ambientes usavam o mesmo banco. Funcionava porque só uma pessoa usava o
sistema, e deixou de funcionar pela mesma razão que sempre deixa: o ambiente onde se testa
migração e se roda script destrutivo passou a ser o ambiente que guarda dado real.

### Qual banco vira qual

A decisão foi manter o banco existente como produção e criar um novo para desenvolvimento,
e não o contrário. O motivo é onde o risco cai. A `DATABASE_URL` de produção já estava
configurada e testada na Vercel; trocá-la significaria mexer no que funciona. Criando o
ambiente novo do lado do desenvolvimento, um engano de configuração custa dado
descartável, não dado real.

### Dev não é cópia de produção

A tentação óbvia é clonar produção para ter dados realistas em desenvolvimento. Isso foi
descartado por antecipação: quando a comunidade entrar, produção vai conter e-mails e
hashes de senha de outras pessoas. Copiá-los para o ambiente onde se testa migração e se
roda script destrutivo espalha dado de terceiro para onde há menos cuidado, sem que
ninguém tenha consentido com isso.

Desenvolvimento passa a nascer de `db:seed-demo`, com projetos e valores fictícios que já
existiam. O custo é não ter dados realistas; o ganho é que nenhum dado de outra pessoa
circula fora de produção.

### Branch em vez de projeto separado

O Neon cria branches copy-on-write instantâneos, isolados entre si. Um branch traz o
schema junto, então não é preciso rodar migração no ambiente novo, e uma migração errada
em `dev` não alcança `production`. Dois projetos separados só compensariam para isolar
faturamento e limites, o que não é o caso.

### Trocar de banco não pode depender de editar arquivo

A primeira versão da separação tinha um buraco de uso: para rodar um script contra
produção seria preciso editar o `.env.local`, apontar para lá e desfazer depois. Isso
transforma a operação mais perigosa do sistema em algo que depende de lembrar de reverter
um arquivo. Basta esquecer uma vez para o próximo comando destrutivo acertar produção sem
avisar.

`scripts/_ambiente.ts` inverteu isso. O `.env.local` aponta para desenvolvimento e nunca
mais muda; produção mora em `.env.production.local` e só é alcançada com `--producao` na
linha de comando. A escolha passa a ser visível no comando digitado, o padrão é sempre o
ambiente descartável, e todo script anuncia ambiente e host antes de agir, com `!!` quando
o alvo é produção.

Um detalhe que quase passou: o `dotenv` não substitui variável já presente no ambiente. Sem
`override: true`, um `.env.local` carregado antes venceria e o `--producao` seria ignorado
em silêncio, que é o pior desfecho imaginável para uma flag como essa.

O `AUTH_SECRET` de produção ficou de fora do `.env.production.local` de propósito. Nenhum
script precisa dele, e o segredo que assina as sessões não ganha nada em existir no disco
de uma máquina de desenvolvimento.

Na mesma leva, `db:seed-demo` deixou de exigir `SEED_USER_ID`. Pedir um UUID colado à mão
obrigava a consultar o banco antes de semear; agora o dono sai de `ADMIN_EMAIL`, que já
está configurado e identifica a mesma pessoa.

### Limpeza com confirmação explícita

O banco de produção carregava sete projetos de teste (`a`, `ab`, `abc`) e zero
lançamentos: nada a preservar. `scripts/limpar-dados.ts` apaga dados e mantém `users` e
`profile_settings`, para não obrigar ninguém a recadastrar o login.

Duas proteções nele valem registro, porque um script destrutivo sem elas é um acidente
esperando o momento: sem `--confirmar` ele só relata o que faria, e imprime o host do
banco antes de agir. Rodar limpeza no banco errado é o engano que este tipo de script
precisa tornar difícil.

A limpeza rodou antes da criação do branch, de propósito: assim `dev` nasce de um `production`
já limpo, em vez de herdar o lixo e precisar de uma segunda limpeza.

---

## Marco 13: Conta pública de demonstração

O projeto é peça de portfólio, e quem avalia não vai clonar o repositório, criar conta no
Neon e rodar migração para ver se funciona. Sem uma forma de entrar, o link para a
aplicação mostra apenas uma tela de login.

A saída óbvia, publicar e-mail e senha no README, tem três buracos. Dois deles são
consequência direta de funcionalidades que já existiam:

| Risco | Origem | Resposta |
|---|---|---|
| Trocar a senha e trancar todos os visitantes seguintes | A aba de perfil, feita no marco 10 | Bloqueio no servidor |
| Renomear a conta para algo que o próximo visitante lê | O nome aparece na barra lateral | Mesmo bloqueio |
| Enxergar e-mails de terceiros | A fila de aprovação | Papel `membro`, nunca `admin` |

O primeiro é o mais interessante: a troca de senha era uma melhoria pedida pelo usuário, e
virou uma vulnerabilidade no momento em que a senha passou a ser pública. Nada mudou no
código dela; mudou o contexto em que roda.

O que **não** precisou de resposta foi o isolamento entre usuários, feito no marco 10 e
verificado na época com um `UPDATE` cruzado que afetou zero linhas. A conta pública vê
apenas os próprios dados porque essa garantia já estava no lugar.

### Coluna, não um terceiro papel

`is_demo` é uma coluna booleana e não um valor de `role`. Acrescentar "demo" ao enum
obrigaria a revisar cada comparação de papel no sistema para decidir o que aquele valor
significa ali, e a maioria das respostas seria "igual a membro". A coluna deixa a
autorização exatamente como estava e liga só o comportamento que muda.

### A trava fica na Server Action

Desabilitar o formulário no cliente não impede nada: a Server Action continua alcançável
por requisição direta, que é justamente o caminho que alguém interessado tentaria. O
bloqueio vive na ação; o formulário desabilitado existe só para a pessoa não preencher três
campos até descobrir que não pode.

### O banco criado com `push` não tinha histórico de migração

Aplicar a coluna revelou um problema anterior: `npm run db:migrate` travava tentando criar
as 14 tabelas que já existiam. A causa é que o banco nasceu de `drizzle-kit push`, que
sincroniza o schema direto e não escreve nada na tabela de controle. Para o Drizzle,
nenhuma migração havia sido aplicada.

`scripts/adotar-migracoes.ts` fecha a lacuna registrando a migração inicial como aplicada,
sem reexecutá-la. O hash é o SHA-256 do conteúdo do arquivo e `created_at` é o carimbo do
journal, porque é assim que o Drizzle identifica cada uma: gravar outra coisa faria a
próxima execução tentar aplicar tudo de novo.

Um detalhe que só apareceu por termos dois ambientes: em produção a migração inicial **já
estava registrada**, e no branch `dev` não. O branch foi criado com "schema only", que copia
a estrutura das tabelas mas não as linhas, e o histórico de migração é linha. Vale como
lembrete de que "só o schema" não inclui o que o schema sabe sobre si mesmo.

O `drizzle.config.ts` passou a escolher o ambiente por `DB_ENV=producao`, com
`npm run db:migrate:prod` já trazendo a variável, pelo mesmo princípio dos outros scripts:
o alvo aparece no comando, não num arquivo editado.

---

## Estado atual

| | |
|---|---|
| Telas | Visão geral, tarefas, projetos, aba do projeto, contas, cotações, histórico, importar |
| Entrada | Login, cadastro, recuperação e espera por aprovação, com credencial verificada |
| Administração | Fila de aprovação, membros com acesso e histórico de recusas |
| Pontos | Programa por projeto, medições por conta e evolução entre medições |
| Saldo | Livro-razão: soma dos lançamentos, com posição em token revalorizada |
| CRUD | Completo no banco, com edição e exclusão em cascata |
| Testes | 159, cobrindo aritmética monetária e de pontos, agregação financeira, seletores, mutações, perfil e alvo de tarefas |
| Verificação | `npm test`, `npm run check`, `npm run lint` e `npm run build` passando |
| Backend | Postgres no Neon, 14 tabelas, escrita por Server Actions |
| Sessão | Auth.js com e-mail e senha; cada conta vê só os próprios dados |
| Produção | Vercel, com banco Neon e segredo de sessão próprio |
| Demonstração | Conta pública com nome e senha travados, dados fictícios |

### Pendências conhecidas

- Meta, recebimento e medição de pontos só podem ser criados e excluídos, não editados.
- Categorias das fixtures são um palpite e precisam de conferência.
- A data no HTML estático fica congelada na constante das fixtures; o navegador corrige ao
  hidratar. Usar `new Date()` no servidor congelaria a data no momento do *build*, o que
  seria pior.
- Sem alternância entre tema claro e escuro: o tema claro está escrito e funcional, falta
  o controle.
- O vínculo projeto×conta só nasce no primeiro lançamento. Funciona, mas é implícito:
  criar o vínculo junto com o projeto tornaria a regra mais previsível.
- Falta separar o ambiente de preview da Vercel: hoje ele não tem variáveis próprias.
