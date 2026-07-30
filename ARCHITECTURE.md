# airdrop-tracker — Arquitetura

Documento de arquitetura do sistema. Escrito **antes** da implementação, para servir como
referência de decisões e como material de portfólio.

**Revisão 4** — categoria de projeto e modelo de perfis compartilhados (§9.2).

---

## 1. Objetivo

Substituir a planilha de controle de farming de airdrops por uma aplicação que responda,
sem esforço manual:

- **Quanto já investi** — por projeto e por conta.
- **O que preciso fazer hoje** — tarefas recorrentes, prazos e metas.
- **Qual o resultado** — P&L realizado, exposição atual, ROI quando o airdrop cai.
- **Onde focar** — status e prioridade de cada projeto.

Objetivo secundário, igualmente importante: o projeto é peça de portfólio. A stack e as
decisões arquiteturais foram escolhidas pensando também em entrevista técnica.

---

## 2. O problema do modelo atual

A planilha de hoje é um **log plano** com as colunas
`Data | Projeto | Conta/Wallet | Ação Realizada | Valor | Status`.

Três limitações estruturais:

**2.1. Conta é texto solto.** `chrome (Perfil 1)`, `brave`, `mbox` são digitados a cada
linha. Não existe a entidade "conta", então é impossível perguntar *"quanto essa carteira
tem espalhado entre todos os projetos?"*. Uma conta é usada em vários projetos — precisa
ser uma entidade própria.

**2.2. Depósito e saldo estão misturados.** A coluna `Ação Realizada` guarda tanto
`Depósito na Plataforma` (um **evento de fluxo**, somável) quanto `Saldo Atualizado`
(uma **foto do saldo**, não somável). Se você somar a coluna de valor, o número está
errado: está somando dinheiro que entrou com dinheiro que já estava lá.

> Essa é a correção mais importante do modelo. Fluxo e saldo vão para tabelas separadas.

**2.3. `Status: Pendente` significa duas coisas diferentes.** Às vezes é "ainda não
executei essa ação" (uma tarefa), às vezes é "o airdrop ainda não caiu" (estado do
projeto). Tarefa e histórico são conceitos distintos e precisam de tabelas distintas.

---

## 3. Stack

| Camada | Escolha | Versão instalada | Por quê |
|---|---|---|---|
| Framework | **Next.js** (App Router) | 16.2.12 | Preenche o Next.js listado no CV sem projeto que comprove. Server Components eliminam a camada de API para leitura. |
| Linguagem | **TypeScript** (strict) | 5.x | Já dominado. |
| Banco | **PostgreSQL / Neon** (serverless) | driver 1.1 | Já dominado no LVL. Free tier, escala pra comunidade. |
| ORM | **Drizzle** | 0.45 | Já dominado. Type-safe, SQL explícito — bom pra agregações. |
| Mutações | **Server Actions** + Zod | — | Substitui Express + tRPC. Menos código, padrão moderno. |
| Validação | **Zod** | 4.4 | Schema único compartilhado cliente/servidor. |
| UI | **Tailwind + shadcn/ui (Radix)** | Tailwind 4 | Já dominado. |
| Gráficos | **Recharts** | 3.10 | Integra com shadcn, leve. |
| Testes | **Vitest** | 4.1 | Já dominado. |
| Deploy | **Vercel** | — | Caminho natural do Next; já feito antes. |

Notas de versão relevantes para a implementação:

- **Next 16, não 15** — 16.2.12 é a versão atual. App Router e Server Actions são os
  mesmos; a diferença prática é Turbopack como bundler padrão do build.
- **Zod 4** — a API de validação de string mudou (`z.email()` no lugar de
  `z.string().email()`, que segue funcionando com aviso de depreciação).
- **Tailwind 4** — configuração por CSS (`@theme` em `globals.css`), sem
  `tailwind.config.js`.

**O que muda em relação ao LVL:** só a camada de servidor. Sai `Express + tRPC + Vite`,
entra `Server Components + Server Actions`. Drizzle, Neon, Zod, Tailwind, shadcn, Vitest e
Vercel permanecem — o risco de execução é baixo e o ganho de skill novo é alto.

**Por que não manter tRPC:** tRPC resolve type-safety entre cliente e servidor separados.
No App Router, Server Components e Server Actions já são type-safe por construção — as duas
camadas se sobreporiam. tRPC já está comprovado no LVL, então nada se perde no CV.

---

## 4. Modelo de dados

### 4.1. Diagrama

```
                        ┌──────────┐
                        │  users   │  (multi-tenant desde o dia 1)
                        └────┬─────┘
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       ┌───────────┐  ┌──────────┐  ┌─────────┐
       │ accounts  │  │ projects │  │  tasks  │
       │(carteiras)│  │(airdrops)│  │         │
       └─────┬─────┘  └────┬─────┘  └────┬────┘
             │             │             │
             │   ┌─────────▼────────┐    ▼
             └──►│ project_accounts │  ┌──────────────────┐
                 │   (par P×C)      │  │ task_occurrences │
                 └─────────┬────────┘  └──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ transactions │  │balance_snapshots│  │ airdrop_claims  │
│ (fluxo, soma)│  │ (foto, ñ soma)  │  │  (TGE caiu)     │
└──────┬───────┘  └─────────────────┘  └─────────────────┘
       │
       ▼                     ┌────────┐      ┌──────────────┐
┌──────────────┐             │ goals  │◄─────│ goal_entries │
│import_batches│             └────────┘      └──────────────┘
│  (undo)      │
└──────────────┘
```

Todas as tabelas de movimento (`transactions`, `balance_snapshots`, `airdrop_claims`)
penduram no par `project_accounts`, não em `projects` e `accounts` soltos. Ver §4.3.

### 4.2. Tabelas

#### `users`
Existe desde o início mesmo sem tela de login.
```
id            uuid PK
email         text unique
handle        text unique   -- usado na URL do perfil: /u/artur
display_name  text          -- como aparece para os outros
name          text
created_at    timestamptz
```

#### `profile_settings` — o que o perfil mostra para os outros
Um registro por usuário, criado junto com a conta. Ver §9.2.
```
user_id        uuid PK FK -> users
is_shared      boolean default false  -- perfil visível para membros logados
show_projects  boolean default true   -- projetos, status, categoria, prioridade
show_tasks     boolean default true   -- rotina: o que faz e com que frequência
show_values    boolean default false  -- valores em dólar
show_accounts  boolean default false  -- rótulos das contas ("chrome (Perfil 1)")
show_wallets   boolean default false  -- endereços 0x… — ver o aviso em §9.2
updated_at     timestamptz
```

#### `accounts` — suas carteiras / perfis
Entidade **global do usuário**, não por projeto. É o que corrige o problema 2.1.
```
id             uuid PK
user_id        uuid FK -> users
label          text          -- "chrome (Perfil 1)", "brave", "mbox"
wallet_address text NULL
email          text NULL
notes          text NULL
is_active      boolean default true
created_at     timestamptz
unique(user_id, label)
```

#### `projects` — os airdrops
```
id                uuid PK
user_id           uuid FK -> users
slug              text          -- "ondo-perp" (usado na URL)
name              text          -- "Ondo Perp"
status            enum          -- pesquisando | ativo | pausado |
                                -- tge_anunciado | distribuido | descartado
category          enum NULL     -- liquidez | interacoes | perps
                                -- como o projeto é farmado; define a rotina
chain             text NULL     -- "Arbitrum", "Solana"
priority          smallint      -- 1..5, definido por você
website_url       text NULL
discord_url       text NULL
twitter_url       text NULL
docs_url          text NULL
expected_tge_date date NULL
notes             text NULL     -- estratégia, tese, observações
created_at        timestamptz
archived_at       timestamptz NULL
unique(user_id, slug)
unique(user_id, name)           -- necessário para o upsert do importador
```

#### `project_accounts` — junção projeto × conta
Entidade central da tabela "conta por conta". Tem dados próprios, não é junção pura.
```
id           uuid PK
project_id   uuid FK -> projects
account_id   uuid FK -> accounts
status       enum          -- ativa | pausada | queimada
started_at   date
notes        text NULL
unique(project_id, account_id)   -- alvo das FKs compostas (§4.3)
```

#### `transactions` — eventos de fluxo (somáveis)
```
id                uuid PK
user_id           uuid FK -> users
project_id        uuid FK -> projects   ─┐ FK composta ->
account_id        uuid FK -> accounts   ─┘ project_accounts(project_id, account_id)
occurred_at       date NOT NULL
type              enum   -- deposit | withdrawal | trade_pnl |
                         -- fee_gas | volume_traded | other
amount_usd        numeric(18,2) NOT NULL
description       text NULL
import_batch_id   uuid FK -> import_batches NULL
dedupe_key        text NULL                    -- idempotência de importação
created_at        timestamptz
index(user_id, project_id, occurred_at)
unique(user_id, dedupe_key)   -- parcial: WHERE dedupe_key IS NOT NULL
```

`trade_pnl` negativo cobre o `Perda em Trade` da planilha. `volume_traded` registra volume
operado (não é fluxo de caixa — fica fora do P&L, alimenta metas; ver §4.3-C).

#### `balance_snapshots` — fotos de saldo (NÃO somáveis)
```
id                uuid PK
user_id           uuid FK -> users
project_id        uuid FK -> projects   ─┐ FK composta ->
account_id        uuid FK -> accounts   ─┘ project_accounts
taken_at          date NOT NULL
balance_usd       numeric(18,2) NOT NULL
note              text NULL
import_batch_id   uuid FK -> import_batches NULL
dedupe_key        text NULL
unique(project_id, account_id, taken_at)   -- um snapshot por dia por par
index(project_id, account_id, taken_at desc)
```
Só o snapshot mais recente de cada par `(projeto, conta)` conta para exposição atual.
É o `Saldo Atualizado` da planilha, agora sem poluir o somatório.

#### `tasks` — o que precisa ser feito
Cobre recorrente e prazo fixo na mesma tabela.
```
id              uuid PK
user_id         uuid FK -> users
project_id      uuid FK -> projects
account_id      uuid FK -> accounts NULL  -- NULL = vale para todas as contas do projeto
title           text
description     text NULL
recurrence      enum   -- none | daily | weekly | monthly | every_n_days
interval_days   smallint NULL             -- usado quando every_n_days
due_date        date NULL                 -- usado quando recurrence = none
is_active       boolean default true
created_at      timestamptz
```

#### `task_occurrences` — ocorrências geradas
```
id            uuid PK
task_id       uuid FK -> tasks ON DELETE CASCADE
account_id    uuid FK -> accounts
due_date      date
completed_at  timestamptz NULL
skipped       boolean default false
unique(task_id, account_id, due_date)   -- garante idempotência (§6)
```

#### `goals` — metas de volume/valor
```
id            uuid PK
user_id       uuid FK -> users
project_id    uuid FK -> projects
account_id    uuid FK -> accounts NULL
metric        enum   -- volume_usd | balance_usd | tx_count | days_active
target_value  numeric(18,2)
deadline      date NULL
achieved_at   timestamptz NULL
```
`current_value` **não** é coluna — é derivado. Ver §4.3-C para a fonte de cada métrica.

#### `goal_entries` — progresso manual de meta
Só existe para métricas que não podem ser derivadas de outra tabela.
```
id            uuid PK
goal_id       uuid FK -> goals ON DELETE CASCADE
occurred_at   date
value         numeric(18,2)
note          text NULL
```

#### `airdrop_claims` — quando o token cai
```
id                uuid PK
user_id           uuid FK -> users
project_id        uuid FK -> projects   ─┐ FK composta ->
account_id        uuid FK -> accounts   ─┘ project_accounts
received_at       date
token_symbol      text
token_amount      numeric(36,18)
price_usd         numeric(18,8)   -- preço no momento do registro
value_usd         numeric(18,2)   -- token_amount * price_usd, congelado
```
Tabela própria em vez de um `type` de transação: tem campos que não cabem no modelo
de transação (símbolo, quantidade com 18 casas). O P&L soma as duas fontes.

#### `import_batches` — rastro de cada importação
```
id             uuid PK
user_id        uuid FK -> users
filename       text
imported_at    timestamptz
row_count      integer
created_projects  integer
created_accounts  integer
status         enum   -- concluida | revertida
```
Permite desfazer uma importação inteira sem tocar nos lançamentos manuais.

### 4.3. Três decisões de integridade

**A. `account_id` é NOT NULL nas tabelas de movimento.**
Na versão anterior era nullable. Consequência: linhas órfãs que aparecem no total do
projeto mas em nenhuma linha da tabela conta-por-conta — os dois números não fecham e não
existe forma de descobrir de qual conta o dinheiro saiu. Na sua planilha, toda linha já tem
conta preenchida. Tornar obrigatório elimina a classe inteira de bug.

**B. FK composta para `project_accounts`.**
Com `project_id` e `account_id` como FKs independentes, nada impede registrar uma transação
para um par que não existe — dinheiro numa conta que nunca foi vinculada àquele projeto.

```sql
FOREIGN KEY (project_id, account_id)
  REFERENCES project_accounts (project_id, account_id)
```

Mantém as duas colunas (queries por projeto continuam sem join) **e** garante que o par
existe. Efeito colateral desejável: vincular a conta ao projeto vira passo explícito, então
a tabela conta-por-conta nunca fica desatualizada.

**C. Fonte de cada métrica de meta.**
Na versão anterior `goals.metric = volume_usd` não tinha de onde sair — volume de trading
não se deriva de depósito. Furo corrigido:

| métrica | fonte | agregação |
|---|---|---|
| `volume_usd` | `transactions` tipo `volume_traded` **+** `goal_entries` | SUM |
| `balance_usd` | `balance_snapshots` | último valor |
| `tx_count` | `transactions` | COUNT |
| `days_active` | `transactions` | COUNT(DISTINCT occurred_at) |

---

## 5. Cálculo financeiro

Definições explícitas, para não haver ambiguidade na implementação:

```
Aportado         = SUM(transactions.amount_usd) WHERE type = 'deposit'
Retirado         = SUM(transactions.amount_usd) WHERE type = 'withdrawal'
Taxas            = SUM(transactions.amount_usd) WHERE type = 'fee_gas'
P&L de trades    = SUM(transactions.amount_usd) WHERE type = 'trade_pnl'
Airdrops         = SUM(airdrop_claims.value_usd)

Exposição atual  = SUM( último balance_snapshot de cada (project, account) )

Resultado        = (Retirado + Exposição atual + Airdrops) − Aportado − |Taxas|
ROI              = Resultado / Aportado
```

`volume_traded` **não entra em nenhuma dessas contas** — é métrica de atividade, não de
caixa. Somá-lo inflaria o capital investido.

**Aritmética decimal, nunca float.** Coluna `numeric(18,2)` no Postgres; o Drizzle
devolve `numeric` como *string*, o que é bom — evita a conversão implícita pra float.
Os cálculos acontecem em centavos (inteiros) em `lib/money.ts` e só viram string
formatada na renderização.

**Datas sem timezone.** Todo campo de "quando aconteceu" é `date`, não `timestamptz`.
Um depósito feito dia 25/06 é dia 25/06 independentemente do fuso do servidor da Vercel.
Só `created_at` e `completed_at` (instantes de sistema) usam `timestamptz`.

---

## 6. Motor de recorrência

Tarefas recorrentes precisam virar ocorrências concretas ("check-in da conta brave,
28/07"). Duas abordagens possíveis:

| | Cron job | **Materialização preguiçosa** (escolhida) |
|---|---|---|
| Como funciona | Job diário cria as ocorrências | Ao abrir o painel, calcula o que deveria existir e cria o que falta |
| Infra extra | Sim (Vercel Cron / worker) | Não |
| Falha silenciosa | Job cai, ocorrências somem | Impossível — sempre recalcula |
| Custo | Roda mesmo sem uso | Só quando você abre |

Fluxo: ao carregar `/tarefas`, para cada `task` ativa, expandir pelas contas vinculadas ao
projeto, calcular as datas devidas na janela `[hoje − 7d, hoje + 30d]` e fazer um
`INSERT ... ON CONFLICT DO NOTHING`. A constraint `unique(task_id, account_id, due_date)`
garante idempotência — o mesmo princípio que você usou no EcoBot.

Lógica isolada em `lib/recurrence.ts` como função pura → testável no Vitest sem banco.

---

## 7. Importação da planilha

### 7.1. Mapeamento

O CSV exportado do Sheets tem `Data | Projeto | Conta / Wallet | Ação Realizada | Valor | Status`.
Cada linha vira **um de dois destinos diferentes**, decidido pela ação:

| Ação Realizada | Destino | Tipo |
|---|---|---|
| `Depósito na Plataforma` | `transactions` | `deposit` |
| `Perda em Trade` | `transactions` | `trade_pnl` (valor negativo) |
| `Saldo Atualizado` | **`balance_snapshots`** | — |
| não reconhecida | fila de revisão | usuário decide |

O ponto não óbvio: `Saldo Atualizado` **não vira transação**. É exatamente o problema 2.2
sendo resolvido no momento da importação.

Também é feito upsert automático:
- cada `Projeto` distinto → `projects` (por `unique(user_id, name)`)
- cada `Conta / Wallet` distinta → `accounts` (por `unique(user_id, label)`)
- cada par distinto → `project_accounts`

Parsing: data em `dd/mm/yyyy`, valor com `$` e vírgula/ponto tolerados.

### 7.2. Idempotência

Importar o mesmo arquivo duas vezes não pode duplicar nada:

```
dedupe_key = sha256(occurred_at | project | account | action | amount | linha)
```

Gravado com `ON CONFLICT (user_id, dedupe_key) DO NOTHING`. Rodar de novo é seguro por
construção — mesma escolha do EcoBot, aplicada a outro contexto.

### 7.3. Fluxo de duas etapas

O importador **nunca escreve direto**. Etapa 1 faz o parse e devolve uma prévia: o que será
criado, o que será ignorado como duplicata, quais linhas não foram reconhecidas. Etapa 2
grava, dentro de uma transação de banco, com `import_batch_id` em cada registro.

Se algo sair errado, `import_batches` permite reverter o lote inteiro sem tocar nos
lançamentos manuais.

### 7.4. Por que isso vale mais que os 15 minutos de digitação

Parsing tolerante, upsert idempotente, prévia antes de gravar e undo transacional é um
conjunto de problemas que aparece em entrevista com frequência — e o histórico entra
correto de uma vez, em vez de re-digitado com erro de dedo.

---

## 8. Estrutura de pastas

```
airdrop-tracker/
├── app/
│   ├── layout.tsx                    # shell, navegação
│   ├── page.tsx                      # Dashboard geral
│   ├── tarefas/page.tsx              # "O que fazer hoje"
│   ├── contas/page.tsx               # gestão de carteiras/perfis
│   ├── importar/page.tsx             # upload + prévia + confirmação
│   └── projetos/
│       ├── page.tsx                  # lista de projetos
│       └── [slug]/
│           ├── page.tsx              # visão geral + tabela conta por conta
│           ├── historico/page.tsx    # log de transações
│           └── airdrop/page.tsx      # registro do que foi recebido
│
├── actions/                          # "use server" — mutações
│   ├── transactions.ts
│   ├── projects.ts
│   ├── accounts.ts
│   ├── tasks.ts
│   ├── claims.ts
│   └── import.ts
│
├── db/
│   ├── schema.ts                     # Drizzle
│   ├── index.ts                      # conexão Neon
│   └── queries/                      # leitura + agregação
│       ├── dashboard.ts
│       ├── projects.ts
│       ├── tasks.ts
│       └── finance.ts
│
├── lib/
│   ├── validators.ts                 # schemas Zod
│   ├── money.ts                      # aritmética decimal
│   ├── recurrence.ts                 # motor de recorrência (puro)
│   ├── csv-parser.ts                 # parse + mapeamento (puro)
│   └── auth.ts                       # getCurrentUserId()
│
├── components/
│   ├── ui/                           # shadcn
│   └── ...
└── tests/
```

### Camadas

```
React Server Components  →  lê direto de db/queries (sem API intermediária)
Client Components        →  chamam Server Actions
Server Actions           →  validam com Zod, chamam db/queries, revalidatePath()
db/queries               →  regras de negócio e agregações (Drizzle)
Drizzle                  →  SQL
Neon Postgres
```

Duas regras:

1. **Nenhum componente chama Drizzle diretamente.** Toda leitura passa por `db/queries`,
   toda escrita por `actions/`. Mantém a lógica de negócio testável e fora do React.
2. **Todo arquivo em `db/` começa com `import 'server-only'`.** No App Router não existe
   fronteira física entre cliente e servidor — um import errado num Client Component
   empacota a string de conexão do Neon no bundle do navegador. O pacote `server-only`
   transforma isso em erro de build.

**Funções puras isoladas:** `lib/recurrence.ts`, `lib/csv-parser.ts` e `lib/money.ts` não
tocam banco nem React. São onde mora a lógica que erra silenciosamente, e onde os testes do
Vitest dão mais retorno.

---

## 9. Identidade, isolamento e perfis compartilhados

### 9.1. Isolamento

Todas as tabelas raiz têm `user_id` desde a primeira migração. Enquanto não há login, a
identidade vem de variável de ambiente; com o Auth.js, da sessão. Trocar isso é trocar
uma função — nenhuma query, nenhuma tabela, nenhuma migração.

### 9.2. Perfil compartilhado

A ferramenta não é só individual: cada pessoa administra o próprio farming e pode abrir o
perfil para os outros membros **em modo leitura**. Ninguém edita o perfil de ninguém.

Isso descarta um audit log ("quem alterou o quê"): como só o dono escreve nos próprios
registros, o autor de qualquer alteração é sempre o dono. O `user_id` já responde a
pergunta; uma tabela de auditoria seria redundante.

Em compensação, introduz uma distinção que o modelo de dono único não tinha:

| | Significado |
|---|---|
| **viewer** | quem está com a sessão aberta |
| **owner** | de quem são os dados sendo exibidos |

Toda leitura passa a precisar dos dois. Hoje `db/queries` assume `viewer === owner` e
filtra por `getCurrentUserId()`; na fase 6 passa a receber `ownerId` explicitamente e a
consultar a permissão. É a mudança de maior alcance da fase, e o motivo de estar
registrada antes de começar.

**Decisões tomadas:**

- **Só membros logados.** Sem sessão, o perfil não abre — nem com o link. Evita
  indexação por buscador e mantém a lista de quem tem acesso sob controle.
- **Todos podem compartilhar**, não só o dono da comunidade. `is_shared` é do usuário.
- **Visibilidade por campo**, não um interruptor único. Cada `show_*` é uma decisão
  separada porque os riscos são muito diferentes entre si.

**Sobre `show_wallets`, que nasce desligado.** Rótulo de conta e endereço de carteira
foram separados de propósito. O rótulo (`chrome (Perfil 1)`) comunica a estratégia
multi-conta, que é o conteúdo útil para a comunidade, e não expõe nada. O endereço
(`0x…`) permite a qualquer visitante ler todo o histórico on-chain, estimar patrimônio e
— o mais grave no contexto — **correlacionar as contas entre si**. Vários projetos usam
análise de cluster para desqualificar farming multi-conta; publicar os endereços juntos
entrega esse agrupamento pronto. Continua sendo escolha do usuário, mas exige um ato
explícito.

### 9.3. Onde a autorização é aplicada

```
Rota /u/[handle]
   ↓
resolverAcesso(viewer, handle)  →  { ownerId, podeEditar, campos } | 404
   ↓
db/queries.*(ownerId, …)        →  filtra por ownerId, respeita `campos`
   ↓
Server Actions                  →  RECUSAM se viewer !== ownerId
```

Duas regras que não podem ser confundidas:

1. **Esconder botão de editar na interface não é segurança.** É conforto visual. A
   verificação que vale é a da Server Action, no servidor, comparando `viewer` com o dono
   do registro que está sendo alterado. Um perfil em modo leitura que só oculta botões
   continua editável por quem souber montar a requisição.
2. **Campo escondido não é campo filtrado.** Se `show_values` está desligado, os valores
   não podem ser enviados ao cliente e apenas ocultados por CSS — precisam não sair da
   query. Caso contrário estão no HTML, visíveis a qualquer um que abra o inspetor.

Na fase 6 entra uma suíte que, para cada rota e cada Server Action, tenta agir como outro
usuário e espera falha — incluindo o caso do visitante de perfil compartilhado tentando
escrever. Row Level Security do Postgres fica como reforço opcional: com Server
Components a query já nasce no servidor com o id da sessão, e RLS adiciona complexidade
de conexão no Neon sem substituir os testes.

---

## 10. Fases de implementação

| Fase | Entrega | Estado ao fim |
|---|---|---|
| **0** | Setup: Next 16, TS strict, Drizzle, Neon, Tailwind, shadcn, Vitest, deploy Vercel | App no ar, vazio |
| **1** | `users`, `accounts`, `projects`, `project_accounts`, `transactions`, `balance_snapshots` + CRUD + Dashboard geral | Números batendo |
| **2** | Importação da planilha: parser, prévia, gravação transacional, undo | **Histórico dentro, planilha aposentada** |
| **3** | Aba do projeto: informações, tabela conta por conta, histórico filtrável | Navegação completa |
| **4** | `tasks` + `task_occurrences` + motor de recorrência + painel "O que fazer hoje" | Deixa de ser só registro |
| **5** | `goals` + `goal_entries` + `airdrop_claims` + P&L completo e gráficos | Ciclo fechado |
| **6** | Auth.js, cadastro, isolamento por usuário + testes de vazamento | Cada um com seu perfil |
| **7** | Perfis compartilhados: `/u/[handle]`, `profile_settings`, modo leitura | Comunidade acompanha |

A importação virou fase 2 (logo após a fundação) e não uma etapa final: é o que permite
parar de manter as duas coisas em paralelo. Fases 1+2 são o MVP real.

---

## 11. Decisões registradas

1. **Fluxo separado de saldo** (`transactions` vs `balance_snapshots`) — sem isso, todo
   somatório financeiro fica errado.
2. **Conta é entidade global**, não string por linha — permite visão transversal por
   carteira.
3. **`account_id` NOT NULL + FK composta para `project_accounts`** — impede movimento
   órfão e movimento em par inexistente.
4. **`user_id` desde o dia 1** — evita migração dolorosa na fase 6.
5. **Valores derivados não são armazenados** (`goals.current_value`, saldos agregados) —
   evita divergência quando um registro antigo é editado.
6. **Toda métrica de meta tem fonte declarada** (§4.3-C) — meta sem fonte é meta que não
   atualiza.
7. **Recorrência preguiçosa em vez de cron** — sem infra extra, idempotente por constraint.
8. **Importação idempotente com prévia e undo** — reimportar é seguro por construção.
9. **`numeric` + centavos inteiros, nunca float** — sem erro de arredondamento.
10. **`date` para eventos, `timestamptz` só para instantes de sistema** — imune a fuso do
    servidor.
11. **`server-only` em toda a camada de dados** — impede vazamento de credencial no bundle.
12. **Server Actions em vez de tRPC** — tRPC já comprovado no LVL; aqui o ganho é Next.js.
13. **Sem tabela de auditoria** — como só o dono escreve nos próprios registros, o autor
    de qualquer alteração é sempre o dono; `user_id` já responde "quem". Auditoria só
    faria sentido se várias pessoas editassem o mesmo perfil.
14. **`viewer` separado de `owner`** (§9.2) — ler o perfil de outra pessoa quebra a
    premissa de dono único; as queries recebem `ownerId` em vez de assumir a sessão.
15. **Visibilidade por campo, com endereço de carteira à parte** — rótulo de conta ensina
    a estratégia sem custo; endereço permite correlacionar as contas entre si e pode
    queimar o farming. São decisões diferentes e ficam em chaves diferentes.
16. **Autorização no servidor, não na interface** — esconder o botão de editar é conforto
    visual; a recusa que vale é a da Server Action. Campo não permitido não sai da query,
    em vez de sair e ser ocultado por CSS.

---

## 12. Fora de escopo (registrado para depois)

- Leitura on-chain automática de saldos (Alchemy/DeBank).
- Integração com CEX via API key.
- Multi-moeda com cotação automática.
- Checklist de critérios de elegibilidade por conta.
- Notificações (Discord/e-mail) de tarefa vencendo.
