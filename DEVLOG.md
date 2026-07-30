# Diário de desenvolvimento

Registro cronológico das decisões, dos problemas encontrados e do raciocínio por trás de
cada escolha. O [`ARCHITECTURE.md`](ARCHITECTURE.md) diz **como o sistema é**; este
documento diz **como se chegou até ele** — incluindo o que foi descartado e o que deu
errado no caminho.

---

## Marco 0 — Arquitetura antes de qualquer código

**Ponto de partida:** uma planilha do Google Sheets com as colunas
`Data | Projeto | Conta/Wallet | Ação Realizada | Valor | Status`.

### Três problemas estruturais na planilha

Antes de propor solução, o diagnóstico do que estava errado no modelo atual:

1. **Conta era texto solto.** `chrome (Perfil 1)`, `brave` e `mbox` eram redigitados a
   cada linha. Sem a entidade "conta", era impossível responder *"quanto essa carteira
   tem espalhado entre todos os projetos?"* — uma pergunta central para quem farma com
   múltiplas contas.

2. **Depósito e saldo dividiam a mesma coluna.** `Depósito na Plataforma` é um evento de
   fluxo (somável); `Saldo Atualizado` é uma foto do saldo (não somável). Somar a coluna
   de valor misturava dinheiro que entrou com dinheiro que já estava lá — **o total da
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
Mantém 80% do que já era dominado — só a camada de servidor muda, de `Express + tRPC`
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
| Meta `volume_usd` sem fonte de dados | Métrica que nunca atualizaria — volume de trading não se deriva de depósito |
| Faltava `server-only` na camada de dados | Um import errado num Client Component empacotaria a `DATABASE_URL` no bundle do navegador |

Corrigidos com: `NOT NULL`, FK composta apontando para `project_accounts`, tipo
`volume_traded` + tabela `goal_entries`, e `import "server-only"` obrigatório em `db/`.

**Lição registrada:** revisar arquitetura escrita por si mesmo, com algum distanciamento,
encontra o que a escrita original não vê. Três revisões antes da primeira linha de código.

---

## Marco 1 — Fase 0: infraestrutura

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
`_` são privadas no Next e não viram rota — a página nunca foi compilada e o build passou,
dando a falsa impressão de que a proteção não funcionava. Renomear para `app/probe/`
revelou o comportamento real.

### `money.ts`: os testes encontraram dois bugs meus

Aritmética monetária em centavos inteiros — valor em dinheiro nunca passa por float. Ao
escrever os testes, dois defeitos apareceram:

1. **`"1.2.3,4,5"` era aceito como válido.** Faltava validar agrupamento de milhar.
   Corrigido com regex de grupos exatos de 3 dígitos.

2. **`"10.005"` é genuinamente ambíguo** — dez mil e cinco (milhar brasileiro) ou dez com
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

## Marco 2 — Front completo com dados de desenvolvimento

Pedido: construir a interface antes do backend, para avaliar o produto antes de investir
no banco.

### A regra que impediu retrabalho

Dados mock atrás da **mesma interface** que as queries reais teriam:

- `db/queries` devolve os view models de `lib/types`, com assinatura `async`;
- as fixtures reproduzem o formato do Drizzle — `numeric` como **string**, data como
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

Nas transcrições da planilha, `Nansen / brave` tem dois snapshots de saldo e **nenhum
depósito registrado**. A interface mostra o saldo sem aporte em vez de corrigir ou
esconder — é informação legítima para o dono decidir o que fazer.

### Acessibilidade medida, não estimada

- Contraste de todos os tokens calculado contra as duas superfícies: pior caso **6.63:1**,
  acima do mínimo AA de 4.5:1.
- **Bug encontrado:** a navegação estava duplicada no DOM (uma cópia para mobile, outra
  para desktop), fazendo leitor de tela anunciar dois menus idênticos. Unificada em um
  único `<nav>` com classes responsivas.

### Gráfico: série única recebe cor única

O gráfico de capital por projeto usa **uma cor só**. Pintar cada projeto de um tom
diferente seria decoração — a identidade já vem do rótulo de texto. O valor aparece
escrito ao lado, então nada depende de enxergar cor ou comprimento. Construído em CSS
puro: acessível por construção e sem biblioteca no bundle.

---

## Marco 3 — Formulários em modo local

Pedido: poder cadastrar dados para testar, ainda sem backend.

### Bug relatado: "nos projetos, ao clicar não entra no projeto"

**Diagnóstico:** apenas o texto do nome era link. Clicar em qualquer outro ponto do card
não fazia nada.

**Correção:** *stretched link* — o `<Link>` continua sendo um único link real (bom para
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

## Marco 4 — Edição e exclusão

### Bug relatado: "todos os botões verdes não estão funcionando"

**Diagnóstico:** o componente do botão primário não repassava as props recebidas.

```tsx
function BotaoNovo({ children }) {        // ← descarta as props
  return <Button size="sm">…</Button>
}
```

`DialogTrigger asChild` clona o elemento e injeta `onClick` **nas props** — que iam para
o lixo. Os botões *outline* funcionavam por usarem `<Button>` direto, o que explicava
exatamente por que só os verdes falhavam. Um `{...props}` corrigiu as cinco chamadas.

**Lição:** um componente que envolve outro e não faz spread de props quebra silenciosamente
qualquer padrão `asChild`.

### Segundo erro meu, pego na revisão

O gatilho de exclusão tinha sido escrito como `<span onClick>` — não alcançável por Tab.
Trocado por `AlertDialogTrigger asChild` sobre um `<button>` real.

### Exclusão em cascata: decisões de produto

Replicando o que as FKs fariam no banco, com duas escolhas que não são óbvias:

- **Desvincular conta de um projeto** remove só os movimentos daquele par. Tirar `chrome`
  do Ondo Perp não mexe no `chrome` do Lighter.
- **Apagar uma conta** converte suas tarefas específicas em tarefas de todas as contas,
  em vez de apagá-las. A intenção de farming sobrevive à conta.

A confirmação informa o tamanho do estrago — *"isso também apaga 8 lançamentos e 2
tarefas"* — em vez de um "tem certeza?" genérico, já que não há desfazer por item.

### Segunda extração para funções puras

A lógica de cascata tinha nascido dentro do componente React: **impossível de testar**.
Movida para `lib/mutations` como `(Dataset, dados) → Dataset`. O provider caiu para uma
casca fina de delegação, e entraram 17 testes que antes não existiam — incluindo um que
garante que nenhuma mutação altera o dataset original.

São as mesmas transformações que as Server Actions vão executar contra o Postgres. O teste
que diz "apagar Saturn faz o total cair de $242 para $142" continua valendo depois da
migração.

---

## Marco 5 — Histórico, categoria e filtros

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

`Liquidez (farm passivo)` · `Interações semanais` · `Perps` — classificação por **tipo de
esforço**, que é o que determina a rotina de trabalho.

### Filtros: contagem vem do conjunto completo

Detalhe de usabilidade decidido de propósito: os contadores dos chips refletem o total,
não o resultado filtrado. Se viessem do filtrado, escolher "Perps" faria as outras
categorias mostrarem 0 — e o usuário perderia a referência de quantos existem. Filtros que
não devolveriam nada são escondidos em vez de oferecidos.

---

## Marco 6 — Modelo de perfis compartilhados

Contexto: a ferramenta será aberta para a comunidade, cada pessoa com seu perfil,
podendo **ver** o perfil dos outros mas não editar.

### Audit log descartado — com justificativa

Eu havia sugerido reservar espaço para uma tabela de auditoria. O usuário apontou que
cada pessoa só altera os próprios dados.

**Ele estava certo.** Se só o dono escreve nos próprios registros, o autor de qualquer
alteração é sempre o dono — `user_id` já responde "quem". Auditoria só faria sentido com
várias pessoas editando o mesmo perfil. Descartado.

### O que o compartilhamento realmente exige

Uma distinção que o modelo de dono único não tinha:

| | Significado |
|---|---|
| **viewer** | quem está com a sessão aberta |
| **owner** | de quem são os dados exibidos |

Hoje `db/queries` assume que coincidem. Na fase 7 passa a receber `ownerId` e consultar
permissão — a mudança de maior alcance da fase de backend, registrada antes de começar.

### Duas armadilhas registradas

1. **Esconder botão não é autorização.** Um perfil em modo leitura que só oculta botões
   continua editável por quem souber montar a requisição. A recusa que vale é a da Server
   Action.
2. **Campo escondido não é campo filtrado.** Valor que não pode ser visto não pode sair da
   query e ser ocultado por CSS — estaria no HTML, legível no inspetor.

### Rótulo de conta separado de endereço de carteira

O usuário marcou "contas e carteiras" como visível. Separei em duas chaves porque os
riscos são diferentes:

- **Rótulo** (`chrome (Perfil 1)`) comunica a estratégia multi-conta. É o conteúdo útil
  para a comunidade, sem custo.
- **Endereço** (`0x…`) permite ler todo o histórico on-chain e, o mais grave,
  **correlacionar as contas entre si**. Vários projetos usam análise de cluster para
  desqualificar farming multi-conta — publicar os endereços juntos entrega o agrupamento
  pronto. Não é só privacidade: pode custar os airdrops.

`show_wallets` nasce desligado e exige ato explícito. A decisão continua do usuário, mas
não fica embutida numa escolha única.

---

## Marco 7 — Programas de pontos e descrição nos saldos

Dois pedidos: acompanhar os programas de pontos (para uma live semanal com a comunidade,
mostrando a evolução do acúmulo) e um campo de descrição ao registrar saldo.

### A armadilha resolvida antes de codar

O pedido foi *"igual tem do capital, coloque uma parte de pontos"*, o que sugeriria
espelhar a estrutura do dinheiro — inclusive um indicador de total.

**Não funciona.** Mil pontos do Ondo e mil do Lighter são unidades diferentes; somá-los
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

Também: um programa com uma única medição devolve variação `null`, não zero — exibir
"+0" na estreia sugeriria estagnação onde só falta base de comparação.

### O teste encontrou outro bug de parsing

`parsePointsInput("1.5,5")` era aceito como 15,5. O parser separava inteiro e decimal
corretamente mas não validava o **agrupamento de milhar** da parte inteira — `"1.5"` não
é agrupamento válido, porque milhar exige grupos de exatos 3 dígitos.

É exatamente o mesmo defeito que `money.ts` teve no Marco 1, cometido de novo em código
novo. Corrigido com a mesma validação de agrupamento.

**Lição:** ao escrever um segundo parser com regra parecida, revisar os casos-limite que o
primeiro já resolveu — a memória de ter corrigido não impede repetir.

### Descrição nos saldos

O campo `note` já existia no schema documentado, mas não no formulário. Ao registrar um
saldo, agora se explica **o que mudou** em relação ao anterior: "rendimento do DeFi",
"perda no trade", "migrado do capital de farm".

A nota aparece no histórico do projeto e no feed de atividade, substituindo o rótulo
genérico "Saldo atualizado" quando existe. Um saldo que caiu passa a dizer por quê.

---

## Estado atual

| | |
|---|---|
| Telas | Visão geral, tarefas, projetos, aba do projeto, contas, histórico, importar |
| Pontos | Programa por projeto, medições por conta e evolução entre medições |
| CRUD | Completo em modo local (localStorage), com edição e exclusão em cascata |
| Testes | 122, cobrindo aritmética monetária e de pontos, agregação financeira, seletores e mutações |
| Verificação | `npm test`, `npm run check`, `npm run lint` e `npm run build` passando |
| Backend | Não iniciado — fixtures atrás da interface definitiva |

### Pendências conhecidas

- Meta, recebimento e medição de pontos só podem ser criados e excluídos, não editados.
- Categorias das fixtures são um palpite e precisam de conferência.
- A data no HTML estático fica congelada na constante das fixtures; o navegador corrige ao
  hidratar. Usar `new Date()` no servidor congelaria a data no momento do *build*, o que
  seria pior.
- Sem alternância entre tema claro e escuro — o tema claro está escrito e funcional, falta
  o controle.
