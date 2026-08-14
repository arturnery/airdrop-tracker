# Arquitetura do airdrop-tracker

Documento de arquitetura do sistema. Escrito **antes** da implementação, para servir como
referência de decisões e como material de portfólio.

**Revisão 9**: banco, Server Actions e sessão em produção.

---

## 1. Objetivo

Substituir a planilha de controle de farming de airdrops por uma aplicação que responda,
sem esforço manual:

- **Quanto já investi**: por projeto e por conta.
- **O que preciso fazer hoje**: tarefas recorrentes, prazos e metas.
- **Qual o resultado**: P&L realizado, exposição atual, ROI quando o airdrop cai.
- **Onde focar**: status e prioridade de cada projeto.

Objetivo secundário, igualmente importante: o projeto é peça de portfólio. A stack e as
decisões arquiteturais foram escolhidas pensando também em entrevista técnica.

---

## 2. O problema do modelo atual

A planilha de hoje é um **log plano** com as colunas
`Data | Projeto | Conta/Wallet | Ação Realizada | Valor | Status`.

Três limitações estruturais:

**2.1. Conta é texto solto.** `chrome (Perfil 1)`, `brave`, `mbox` são digitados a cada
linha. Não existe a entidade "conta", então é impossível perguntar *"quanto essa carteira
tem espalhado entre todos os projetos?"*. Uma conta é usada em vários projetos: precisa
ser uma entidade própria.

**2.2. Depósito e saldo estão misturados.** A coluna `Ação Realizada` guarda tanto
`Depósito na Plataforma` (um **evento de fluxo**, somável) quanto `Saldo Atualizado`
(uma **foto do saldo**, não somável). Se você somar a coluna de valor, o número está
errado: está somando dinheiro que entrou com dinheiro que já estava lá.

> **Resolvido virando livro-razão** (revisão 6): só existe lançamento, e o saldo é a soma
> deles. Foto de saldo deixou de existir, então não há o que misturar. O custo é que toda
> variação precisa ser lançada: inclusive rendimento, que ganhou tipo próprio.

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
| ORM | **Drizzle** | 0.45 | Já dominado. Type-safe, SQL explícito: bom pra agregações. |
| Mutações | **Server Actions** + Zod | (do Next) | Substitui Express + tRPC. Menos código, padrão moderno. |
| Validação | **Zod** | 4.4 | Schema único compartilhado cliente/servidor. |
| UI | **Tailwind + shadcn/ui (Radix)** | Tailwind 4 | Já dominado. |
| Gráficos | **Recharts** | 3.10 | Integra com shadcn, leve. |
| Testes | **Vitest** | 4.1 | Já dominado. |
| Deploy | **Vercel** | (do Next) | Caminho natural do Next; já feito antes. |

Notas de versão relevantes para a implementação:

- **Next 16, não 15**: 16.2.12 é a versão atual. App Router e Server Actions são os
  mesmos; a diferença prática é Turbopack como bundler padrão do build.
- **Zod 4**: a API de validação de string mudou (`z.email()` no lugar de
  `z.string().email()`, que segue funcionando com aviso de depreciação).
- **Tailwind 4**: configuração por CSS (`@theme` em `globals.css`), sem
  `tailwind.config.js`.

**O que muda em relação ao LVL:** só a camada de servidor. Sai `Express + tRPC + Vite`,
entra `Server Components + Server Actions`. Drizzle, Neon, Zod, Tailwind, shadcn, Vitest e
Vercel permanecem: o risco de execução é baixo e o ganho de skill novo é alto.

**Por que não manter tRPC:** tRPC resolve type-safety entre cliente e servidor separados.
No App Router, Server Components e Server Actions já são type-safe por construção: as duas
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
│ transactions │  │ points_snapshots│  │ airdrop_claims  │
│ (livro-razão)│  │ (foto de pontos)│  │  (TGE caiu)     │
└──────┬───────┘  └─────────────────┘  └─────────────────┘
       │
       ▼                     ┌────────┐      ┌──────────────┐
┌──────────────┐             │ goals  │◄─────│ goal_entries │
│import_batches│             └────────┘      └──────────────┘
│  (undo)      │
└──────────────┘
```

Todas as tabelas de movimento (`transactions`, `points_snapshots`, `airdrop_claims`)
penduram no par `project_accounts`, não em `projects` e `accounts` soltos. Ver §4.3.

Não existe `balance_snapshots`: o saldo é a soma dos lançamentos (revisão 6).

### 4.2. Tabelas

#### `users`
Existe desde o início mesmo sem tela de login.
```
id             uuid PK
email          text unique
handle         text unique   -- usado na URL do perfil: /u/artur
display_name   text          -- como aparece para os outros
name           text
password_hash  text NULL     -- hash, nunca a senha; nulo até ser definida
role           enum default 'membro'    -- admin | membro
status         enum default 'pendente'  -- pendente | aprovado | recusado
reviewed_at    timestamptz NULL
review_note    text NULL     -- por que foi recusado; só o admin vê
created_at     timestamptz
```

#### `profile_settings`: o que o perfil mostra para os outros
Um registro por usuário, criado junto com a conta. Ver §9.2.
```
user_id        uuid PK FK -> users
is_shared      boolean default false  -- perfil visível para membros logados
show_projects  boolean default true   -- projetos, status, categoria, prioridade
show_tasks     boolean default true   -- rotina: o que faz e com que frequência
show_values    boolean default false  -- valores em dólar
show_accounts  boolean default false  -- rótulos das contas ("chrome (Perfil 1)")
show_wallets   boolean default false  -- endereços 0x…: ver o aviso em §9.2
updated_at     timestamptz
```

#### `accounts`: suas carteiras / perfis
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

#### `projects`: os airdrops
```
id                uuid PK
user_id           uuid FK -> users
slug              text          -- "vertex-perp" (usado na URL)
name              text          -- "Vertex Perp"
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

#### `project_accounts`: junção projeto × conta
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

#### `transactions`: eventos de fluxo (somáveis)
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
operado (não é fluxo de caixa: fica fora do P&L, alimenta metas; ver §4.3-C).

#### `balance_snapshots`: fotos de saldo (NÃO somáveis)
```
id                uuid PK
user_id           uuid FK -> users
project_id        uuid FK -> projects   ─┐ FK composta ->
account_id        uuid FK -> accounts   ─┘ project_accounts
taken_at          date NOT NULL
balance_usd       numeric(18,2) NOT NULL
note              text NULL       -- explica a variação: "rendimento do DeFi",
                                  -- "perda no trade", "migrado do capital"
import_batch_id   uuid FK -> import_batches NULL
dedupe_key        text NULL
unique(project_id, account_id, taken_at)   -- um snapshot por dia por par
index(project_id, account_id, taken_at desc)
```
Só o snapshot mais recente de cada par `(projeto, conta)` conta para exposição atual.
É o `Saldo Atualizado` da planilha, agora sem poluir o somatório.

#### `tasks`: o que precisa ser feito
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

#### `task_occurrences`: ocorrências geradas
```
id            uuid PK
task_id       uuid FK -> tasks ON DELETE CASCADE
account_id    uuid FK -> accounts
due_date      date
completed_at  timestamptz NULL
skipped       boolean default false
unique(task_id, account_id, due_date)   -- garante idempotência (§6)
```

#### `goals`: metas de volume/valor
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
`current_value` **não** é coluna: é derivado. Ver §4.3-C para a fonte de cada métrica.

#### `goal_entries`: progresso manual de meta
Só existe para métricas que não podem ser derivadas de outra tabela.
```
id            uuid PK
goal_id       uuid FK -> goals ON DELETE CASCADE
occurred_at   date
value         numeric(18,2)
note          text NULL
```

#### `airdrop_claims`: quando o token cai
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

#### `import_batches`: rastro de cada importação
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
projeto mas em nenhuma linha da tabela conta-por-conta: os dois números não fecham e não
existe forma de descobrir de qual conta o dinheiro saiu. Na sua planilha, toda linha já tem
conta preenchida. Tornar obrigatório elimina a classe inteira de bug.

**B. FK composta para `project_accounts`.**
Com `project_id` e `account_id` como FKs independentes, nada impede registrar uma transação
para um par que não existe: dinheiro numa conta que nunca foi vinculada àquele projeto.

```sql
FOREIGN KEY (project_id, account_id)
  REFERENCES project_accounts (project_id, account_id)
```

Mantém as duas colunas (queries por projeto continuam sem join) **e** garante que o par
existe. Efeito colateral desejável: vincular a conta ao projeto vira passo explícito, então
a tabela conta-por-conta nunca fica desatualizada.

**C. Fonte de cada métrica de meta.**
Na versão anterior `goals.metric = volume_usd` não tinha de onde sair: volume de trading
não se deriva de depósito. Furo corrigido:

A tabela abaixo é do desenho original e **já não descreve o sistema**. Fica registrada
porque enganou: ela cita `balance_snapshots`, uma tabela que foi desenhada aqui e nunca
chegou a existir, e essa citação foi lida um ano depois como se a funcionalidade estivesse
pronta (ver §14.9-B).

| métrica | fonte planejada em 2025 | virou |
|---|---|---|
| `volume_usd` | `transactions` tipo `volume_traded` | `goal_entries` (§14.10) |
| `balance_usd` | `balance_snapshots` | `goal_entries`; a tabela nunca existiu |
| `tx_count` | `transactions` | `goal_entries` (§14.10) |
| `days_active` | `transactions` | `goal_entries` (§14.10) |

Hoje **toda** meta soma os próprios lançamentos, qualquer que seja a métrica. O motivo está
em §14.10.

### 4.4. Programas de pontos

Muitos projetos distribuem pontos antes do token. O acompanhamento é análogo ao do saldo
em dólar: a plataforma mostra um **acumulado**, não um extrato, então o que se registra
é a foto do total e o ganho do período sai da diferença entre duas fotos.

```
projects.points_label   text NULL   -- "Pontos", "XP", "Marks"
                                    -- NULL = o projeto não tem programa
```

#### `points_snapshots`
```
id           uuid PK
user_id      uuid FK -> users
project_id   uuid FK -> projects   ─┐ FK composta ->
account_id   uuid FK -> accounts   ─┘ project_accounts
taken_at     date NOT NULL
points       numeric(24,4) NOT NULL
note         text NULL
unique(project_id, account_id, taken_at)   -- uma medição por dia por par
```

**Pontos nunca são somados entre projetos.** Mil pontos de um projeto e mil de outro são
unidades distintas; somá-los não produz informação. Só existe agregação **dentro** de um
projeto, entre suas contas. Por isso não há indicador de "total de pontos" em lugar
nenhum da interface: o que se compara entre projetos é a **variação**, não o acumulado.

**Aritmética separada** (`lib/points.ts`, não `lib/money.ts`): escala de 4 casas em vez de
2, valores muito maiores, e, o mais importante, ponto nunca entra em aporte, exposição,
P&L ou ROI. Compartilhar o tipo `Cents` abriria a porta para somar ponto com dinheiro sem
que o compilador reclamasse.

**Comparação conta a conta.** As contas nem sempre são medidas no mesmo dia. Comparar o
total de duas datas misturaria contas medidas em momentos diferentes; a variação é
calculada por conta e só depois somada.

---

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

`volume_traded` **não entra em nenhuma dessas contas**: é métrica de atividade, não de
caixa. Somá-lo inflaria o capital investido.

**Aritmética decimal, nunca float.** Coluna `numeric(18,2)` no Postgres; o Drizzle
devolve `numeric` como *string*, o que é bom: evita a conversão implícita pra float.
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
| Falha silenciosa | Job cai, ocorrências somem | Impossível: sempre recalcula |
| Custo | Roda mesmo sem uso | Só quando você abre |

Fluxo: ao carregar `/tarefas`, para cada `task` ativa, expandir pelas contas vinculadas ao
projeto, calcular as datas devidas na janela `[hoje − 7d, hoje + 30d]` e fazer um
`INSERT ... ON CONFLICT DO NOTHING`. A constraint `unique(task_id, account_id, due_date)`
garante idempotência: o mesmo princípio que você usou no EcoBot.

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
| `Saldo Atualizado` | `transactions` | **diferença** para o saldo anterior |
| não reconhecida | fila de revisão | usuário decide |

O ponto não óbvio está na terceira linha. No modelo de livro-razão (revisão 6) não existe
registro de saldo, então uma linha de `Saldo Atualizado` vira o **movimento que explica a
diferença** em relação ao que já estava lançado. É o problema 2.2 sendo resolvido no
momento da importação, e não copiado para dentro do sistema.

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
construção: mesma escolha do EcoBot, aplicada a outro contexto.

### 7.3. Fluxo de duas etapas

O importador **nunca escreve direto**. Etapa 1 faz o parse e devolve uma prévia: o que será
criado, o que será ignorado como duplicata, quais linhas não foram reconhecidas. Etapa 2
grava, dentro de uma transação de banco, com `import_batch_id` em cada registro.

Se algo sair errado, `import_batches` permite reverter o lote inteiro sem tocar nos
lançamentos manuais.

### 7.4. Por que isso vale mais que os 15 minutos de digitação

Parsing tolerante, upsert idempotente, prévia antes de gravar e undo transacional é um
conjunto de problemas que aparece em entrevista com frequência: e o histórico entra
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
├── actions/                          # "use server": mutações
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
   fronteira física entre cliente e servidor: um import errado num Client Component
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
uma função: nenhuma query, nenhuma tabela, nenhuma migração.

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

- **Só membros logados.** Sem sessão, o perfil não abre: nem com o link. Evita
  indexação por buscador e mantém a lista de quem tem acesso sob controle.
- **Todos podem compartilhar**, não só o dono da comunidade. `is_shared` é do usuário.
- **Visibilidade por campo**, não um interruptor único. Cada `show_*` é uma decisão
  separada porque os riscos são muito diferentes entre si.

**Sobre `show_wallets`, que nasce desligado.** Rótulo de conta e endereço de carteira
foram separados de propósito. O rótulo (`chrome (Perfil 1)`) comunica a estratégia
multi-conta, que é o conteúdo útil para a comunidade, e não expõe nada. O endereço
(`0x…`) permite a qualquer visitante ler todo o histórico on-chain, estimar patrimônio e
 o mais grave no contexto: **correlacionar as contas entre si**. Vários projetos usam
análise de cluster para desqualificar farming multi-conta; publicar os endereços juntos
entrega esse agrupamento pronto. Continua sendo escolha do usuário, mas exige um ato
explícito.

### 9.3. Papel e fila de aprovação

O controle de acesso escolhido é **cadastro livre com aprovação manual**: qualquer pessoa
cria conta e fica em `pendente` até ser liberada. Isso introduz duas coisas que o modelo
não tinha.

**Papel.** Alguém precisa aprovar, e essa pessoa vê dados que os demais não veem: a lista
de quem pediu acesso, com e-mails. `users.role` (`admin` | `membro`) resolve, e a rota de
administração exige `admin` **no servidor**: esconder o link do menu não é controle, é
decoração.

```
users.role   enum default 'membro'   -- admin | membro
```

#### `members`: solicitações de acesso
Na fase de backend isto se funde a `users`: a solicitação vira o próprio usuário com
`status`. Enquanto não há login, existe como coleção separada para desenhar a tela.
```
id            uuid PK
name          text
email         text unique
status        enum         -- pendente | aprovado | recusado
registered_at date
reviewed_at   date NULL
note          text NULL    -- por que foi recusado; visível só para o admin
```

**Recusa não apaga o registro.** Some da fila mas fica no histórico, por dois motivos:
quem foi recusado não reaparece como cadastro novo, e a decisão pode ser revista com o
motivo à vista.

#### O primeiro administrador

A tela de aprovação exige um admin logado: então a conta que aprova não pode depender de
aprovação. Sem resolver isso, ninguém entra nunca.

| Abordagem | Problema |
|---|---|
| Primeiro cadastro vira admin | Quem descobrir a URL antes do dono assume o sistema |
| Promover por SQL na mão | Funciona, mas depende de lembrar o comando e de acesso ao banco |
| **`ADMIN_EMAIL` em variável de ambiente** | Escolhida |

```
ADMIN_EMAIL="voce@exemplo.com"
```

Quem se cadastrar com esse e-mail nasce `role: "admin"` e `status: "aprovado"`. A
variável só identifica o dono: **não guarda senha**, que continua sendo escolhida no
cadastro e gravada como hash.

Três propriedades que fizeram a escolha:

1. **Só quem controla o ambiente decide.** Variável de ambiente não é adivinhável nem
   alcançável pela aplicação.
2. **Não há janela de exposição.** A regra vale desde o primeiro deploy, diferente de
   "primeiro cadastro vira admin", que abre uma corrida contra desconhecidos.
3. **Mudar a variável não rebaixa ninguém.** O papel fica gravado no banco; a variável só
   atua no momento do cadastro. Para trocar de administrador, altera-se o papel no banco.

`npm run db:seed` cria a conta antecipadamente com `password_hash` nulo: a senha é
definida no primeiro acesso. O script não pede nem aceita senha: senha em variável de
ambiente ou em argumento de linha de comando termina no histórico do shell.

**Revogar acesso e reconsiderar recusa são a mesma operação**: devolver para `pendente`,
limpando a decisão anterior. Uma função só, dois botões.

### 9.4. Onde a autorização é aplicada

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
   não podem ser enviados ao cliente e apenas ocultados por CSS: precisam não sair da
   query. Caso contrário estão no HTML, visíveis a qualquer um que abra o inspetor.

Na fase 6 entra uma suíte que, para cada rota e cada Server Action, tenta agir como outro
usuário e espera falha: incluindo o caso do visitante de perfil compartilhado tentando
escrever. Row Level Security do Postgres fica como reforço opcional: com Server
Components a query já nasce no servidor com o id da sessão, e RLS adiciona complexidade
de conexão no Neon sem substituir os testes.

---

## 10. Fases de implementação

| Fase | Entrega | Estado ao fim |
|---|---|---|
| **0** | Setup: Next 16, TS strict, Drizzle, Neon, Tailwind, shadcn, Vitest, deploy Vercel | App no ar, vazio |
| **1** ✅ | `users`, `accounts`, `projects`, `project_accounts`, `transactions`, `balance_snapshots` + CRUD + Dashboard geral | Números batendo |
| **2** | Importação da planilha: parser, prévia, gravação transacional, undo | **Histórico dentro, planilha aposentada** |
| **3** | Aba do projeto: informações, tabela conta por conta, histórico filtrável | Navegação completa |
| **4** | `tasks` + `task_occurrences` + motor de recorrência + painel "O que fazer hoje" | Deixa de ser só registro |
| **5** | `goals` + `goal_entries` + `airdrop_claims` + P&L completo e gráficos | Ciclo fechado |
| **6** ✅ | Auth.js, cadastro, isolamento por usuário + testes de vazamento | Cada um com seu perfil |
| **7** | Auth.js, fila de aprovação, papel de admin | Comunidade entra |
| **8** | Perfis compartilhados: `/u/[handle]`, `profile_settings`, modo leitura | Comunidade acompanha |
| **9** | Catálogo de projetos: `catalog_projects`, publicação, aba de descoberta e adoção por cópia (§13) | Ninguém cadastra do zero |

A importação virou fase 2 (logo após a fundação) e não uma etapa final: é o que permite
parar de manter as duas coisas em paralelo. Fases 1+2 são o MVP real.

---

## 11. Decisões registradas

1. **Fluxo separado de saldo** (`transactions` vs `balance_snapshots`): sem isso, todo
   somatório financeiro fica errado.
2. **Conta é entidade global**, não string por linha: permite visão transversal por
   carteira.
3. **`account_id` NOT NULL + FK composta para `project_accounts`**: impede movimento
   órfão e movimento em par inexistente.
4. **`user_id` desde o dia 1**: evita migração dolorosa na fase 6.
5. **Valores derivados não são armazenados** (`goals.current_value`, saldos agregados):
   evita divergência quando um registro antigo é editado.
6. **Toda métrica de meta tem fonte declarada** (§4.3-C): meta sem fonte é meta que não
   atualiza.
7. **Recorrência preguiçosa em vez de cron**: sem infra extra, idempotente por constraint.
8. **Importação idempotente com prévia e undo**: reimportar é seguro por construção.
9. **`numeric` + centavos inteiros, nunca float**: sem erro de arredondamento.
10. **`date` para eventos, `timestamptz` só para instantes de sistema**: imune a fuso do
    servidor.
11. **`server-only` em toda a camada de dados**: impede vazamento de credencial no bundle.
12. **Server Actions em vez de tRPC**: tRPC já comprovado no LVL; aqui o ganho é Next.js.
13. **Sem tabela de auditoria**: como só o dono escreve nos próprios registros, o autor
    de qualquer alteração é sempre o dono; `user_id` já responde "quem". Auditoria só
    faria sentido se várias pessoas editassem o mesmo perfil.
14. **`viewer` separado de `owner`** (§9.2): ler o perfil de outra pessoa quebra a
    premissa de dono único; as queries recebem `ownerId` em vez de assumir a sessão.
15. **Visibilidade por campo, com endereço de carteira à parte**: rótulo de conta ensina
    a estratégia sem custo; endereço permite correlacionar as contas entre si e pode
    queimar o farming. São decisões diferentes e ficam em chaves diferentes.
16. **Pontos com tipo e aritmética próprios** (§4.4): unidade por projeto, escala
    diferente e nunca somáveis entre si nem com dinheiro; o tipo separado impede a soma
    indevida em tempo de compilação.
17. **Autorização no servidor, não na interface**: esconder o botão de editar é conforto
    visual; a recusa que vale é a da Server Action. Campo não permitido não sai da query,
    em vez de sair e ser ocultado por CSS.
18. **Sem branch `dev` nem ambiente de preview hospedado**, com um desenvolvedor só (§11.1).

### 11.1. Por que não existe branch `dev`

O fluxo é `main` direto para produção. A alternativa considerada era manter uma branch
`dev` com deploy próprio na Vercel, apontando para o banco de desenvolvimento.

**Descartado enquanto o projeto tiver um desenvolvedor.** A separação por branch resolve
problemas que nascem de trabalho simultâneo: revisar o que outra pessoa escreveu antes de
ir para produção, segurar uma entrega enquanto outra é corrigida, evitar que dois trabalhos
inacabados se misturem. Nada disso existe aqui, e o ganho concreto restante seria abrir o
sistema em outro aparelho.

O que **não** foi descartado é a separação de dados: `production` e `dev` são bancos
distintos desde o começo (§ ambientes), e é isso que impede um teste de tocar dado real.
Branch é sobre organizar trabalho; banco separado é sobre proteger dado. Só o segundo é
inegociável para uma pessoa.

**Custo assumido, registrado para não ser esquecido:** o servidor local não é idêntico à
produção. Ele roda sem otimização de build, o cache do Next se comporta de outro jeito e a
latência até o banco é diferente. Alguns defeitos aparecem só no ambiente hospedado, e hoje
quem faz esse papel de verificação final é o próprio deploy de produção.

**Quando essa decisão deve ser revista:** no dia em que uma segunda pessoa escrever código,
ou quando houver usuários o bastante para que um defeito em produção custe mais que o tempo
de manter o ambiente extra.

---

## 13. Catálogo de projetos da comunidade (modelado, não implementado)

### 13.1. O problema

Hoje cada pessoa que entra recebe uma tela vazia e precisa cadastrar do zero cada projeto
que farma, caçando link de Discord, documentação e data prevista de TGE. Esse trabalho é
idêntico para todo mundo, e é feito uma vez por pessoa.

A proposta inverte isso: quem administra cadastra o projeto uma vez, ele aparece num
catálogo para a comunidade, e quem farma aquele projeto o adiciona aos próprios com um
clique, passando a registrar aportes, histórico e tarefas normalmente.

### 13.2. A separação que o modelo atual não tem

Os campos de `projects` hoje convivem numa tabela só porque só existia um dono. A proposta
os divide segundo a natureza de cada um:

| Editorial (igual para todos) | Pessoal (de cada um) |
|---|---|
| nome, categoria, chain | status: ativo, pausado, descartado |
| site, Discord, Twitter, docs | prioridade |
| data prevista de TGE | anotações |
| rótulo do programa de pontos | aportes, tarefas, metas, pontos, recebimentos |

O Discord do Meridian é o mesmo para qualquer pessoa; o status "pausado" é de quem pausou.
Sem essa divisão, o catálogo não teria como existir.

### 13.3. Decisão: cópia, não vínculo

Ao adotar, os campos do catálogo são **copiados** para um projeto novo da pessoa, que passa
a ser dela por inteiro. Quem administra não altera mais nada ali depois.

O vínculo foi considerado primeiro, com o argumento de que corrigir a data de TGE uma vez
alcançaria todo mundo. Foi descartado por uma razão que pesa mais: **o projeto adotado é da
pessoa**. Ela deve poder renomear, corrigir a rede, ajustar o que quiser, e o curador não
deve conseguir mexer em nada que já esteja no espaço de outro usuário. Um projeto que muda
sozinho porque alguém editou em outro lugar é um comportamento difícil de explicar para
quem está olhando os próprios números.

**Custo aceito:** corrigir um link no catálogo não alcança quem já adotou. O catálogo passa
a valer pelo que economiza no cadastro inicial, que é onde estava a dor, e não por manter
todo mundo sincronizado.

**O que isso simplifica.** Com cópia, o pior problema do desenho anterior deixa de existir:
não há mais o risco de uma ação administrativa alcançar dados financeiros de terceiros,
porque não sobra nenhuma dependência entre a entrada do catálogo e o projeto adotado.
Arquivar ou apagar do catálogo não toca em ninguém.

### 13.4. Tabelas

```
catalog_projects            entrada curada, sem dados financeiros
  id, slug, name, category, chain, points_label,
  website_url, discord_url, twitter_url, docs_url,
  expected_tge_date, summary,
  created_by      -> users.id (sempre um admin)
  published_at    null = rascunho, só o autor enxerga
  archived_at     sai do catálogo sem apagar histórico de curadoria

projects                    farming de uma pessoa (tabela atual, sem mudança
                            de comportamento)
  + adopted_from_id         referência histórica: de qual entrada veio.
                            ON DELETE SET NULL, e nada depende dela para exibir
  + unique (user_id, adopted_from_id)
```

`adopted_from_id` não é usada para ler nada: serve para não oferecer duas vezes o mesmo
projeto a quem já adotou, e para saber quantas pessoas pegaram cada entrada. Todo campo
exibido vive na linha da própria pessoa.

A unicidade impede adotar o mesmo projeto duas vezes. Múltiplas carteiras no mesmo projeto
já são resolvidas por `project_accounts`, não por projetos repetidos.

### 13.5. O que a cópia elimina

Vale registrar o que **não** precisa ser construído por causa desta escolha, porque era a
parte mais delicada do desenho com vínculo:

- Nenhuma regra impedindo excluir uma entrada adotada por outras pessoas.
- Nenhuma desnormalização defensiva de campos para o caso de a origem sumir.
- Nenhuma decisão sobre o que acontece com quem adotou quando o curador despublica.
- Nenhuma leitura com duas origens possíveis por campo.

O projeto adotado é indistinguível de um projeto criado à mão, e todo o código de leitura,
edição e exclusão que já existe continua valendo sem exceção.

### 13.6. Autorização

| Ação | Quem |
|---|---|
| Criar, editar, publicar e arquivar no catálogo | Apenas `admin` |
| Ler entradas publicadas | Qualquer membro aprovado |
| Adotar | Qualquer membro aprovado, para si mesmo |

Publicar é um ato explícito: criar um projeto continua privado por padrão. Sem isso,
qualquer teste ou projeto que ainda não se queira sinalizar apareceria para a comunidade.

A adoção cria uma linha em `projects` do próprio usuário, então todo o isolamento existente
continua valendo sem mudança: ninguém enxerga o farming de ninguém, só a entrada do
catálogo é compartilhada.

### 13.7. Fora do escopo desta proposta

- **Tarefas sugeridas junto do projeto.** Aumentaria bastante o valor para a comunidade e
  também o tamanho da entrega. Fica para depois de o catálogo existir.
- **Sincronizar correções com quem já adotou** (ver 13.3): descartado, não adiado.
- **Catálogo aberto a contribuição de membros.** Só admin publica; curadoria é o produto.


---

## 14. Suporte e feedback

### 14.1. O problema

Quando algo quebra, o relato chega por fora e sem contexto: "está dando erro ao lançar".
Descobrir o que aconteceu exige perguntar em qual tela, o que foi digitado e quando, e cada
ida e volta custa horas.

O caso do tipo "Outro" ilustra o custo. O relato foi "não está salvando", e o defeito era
outro: salvava e não movia nenhum número. Só ficou claro consultando o banco e encontrando
dois lançamentos idênticos, sinal de que a pessoa tentou duas vezes. Um formulário dentro
do sistema teria trazido a tela de origem e a versão junto, e o diagnóstico começaria do
lugar certo.

### 14.2. O que o formulário anexa sozinho

É isto que justifica construir em vez de pedir um e-mail:

| Campo | Origem | Por que importa |
|---|---|---|
| `user_id` | Sessão, nunca o formulário | Identifica sem perguntar, e permite responder |
| `rota` | Tela onde o botão foi clicado | Metade dos relatos se resolve sabendo só isso |
| `versao` | Changelog no momento do envio | Distingue defeito já corrigido de defeito atual |
| `created_at` | Servidor | Cruza com o que foi publicado naquele dia |

```
feedback
  id            uuid
  user_id       -> users.id, ON DELETE CASCADE
  tipo          bug | duvida | sugestao
  mensagem      text
  rota          text
  versao        text
  created_at    timestamptz
  lido_em       timestamptz, nulo enquanto não aberto
  resolvido_em  timestamptz, nulo enquanto em aberto
```

### 14.3. Caixa de entrada, não sistema de tickets

Responder **dentro** do sistema exigiria thread de mensagens, estado de conversa, tela de
resposta para quem administra, tela de leitura para quem enviou e um segundo contador
avisando que houve resposta. Cerca de três vezes o trabalho.

Descartado por uma razão que vale registrar: **não acrescenta nada tecnicamente**. O
projeto já tem três filas com o mesmo desenho (aprovação de membro, pedido de senha e este
feedback), e todas usam autorização por papel, estado pendente/resolvido e isolamento por
usuário. A quarta seria repetição.

A resposta sai por e-mail, que **já está no cadastro**. A tela de suporte oferece um
`mailto:` com destinatário, assunto e o relato citado no corpo: responder vira escrever e
enviar, sem procurar o endereço nem copiar o texto. O atrito de responder é o que decide se
as respostas acontecem.

### 14.4. Como quem administra fica sabendo

Contador de não lidos no menu lateral, visível apenas para admin.

É o conserto de uma lacuna que já existe: os pedidos de senha (§ recuperação) só aparecem
para quem abre a tela de membros. Uma fila que depende de alguém lembrar de olhar é uma
fila que acumula.

### 14.5. A conta pública pode enviar

A conta de demonstração está no README, então qualquer visitante pode escrever. Foi
decidido **aceitar e marcar**, em vez de bloquear: quem experimenta sem cadastro também tem
o que dizer, e é justamente quem esbarra nas arestas do primeiro uso.

O risco disso é volume. A defesa é um limite de envios por conta por dia, na mesma linha do
limite de pedidos de senha: sem ele, uma pessoa mal-intencionada enche o banco em minutos e
a caixa deixa de ser utilizável.

### 14.6. Apagar só depois de resolver

A exclusão de um relato existe, e aparece **apenas para os já resolvidos**. Não é restrição
por restrição: obriga um passo entre receber e descartar, e impede apagar algo antes de ler.

Sem volta, como toda exclusão do sistema: o texto não fica guardado em lugar nenhum. Por
isso a confirmação diz o que se perde, em vez de perguntar "tem certeza?".

### 14.7. Fora do escopo desta proposta

- **Anexar imagem.** Exige upload e armazenamento, e a maior parte dos relatos se resolve
  com texto mais o contexto automático.
- **Status visível para quem enviou.** Só faz sentido havendo resposta pelo sistema, que foi
  descartada em 14.3.
- **Categorias além das três.** Refinar depois de ver o que realmente chega, em vez de
  adivinhar agora.

---

## 14.8. Cores: a marca não substitui o significado

O produto é **LVL Airdrops**, ligado à marca do cliente, cuja identidade é azul. O sistema
usa verde como cor primária desde o começo. As duas convivem com papéis separados, e a
separação é a decisão:

| | Onde vale |
|---|---|
| **Azul (marca)** | Símbolo, ícone da aba, tela de entrada, anel de foco, estilização |
| **Verde (domínio)** | Resultado positivo, ganho, conclusão, capital |
| **Vermelho (domínio)** | Prejuízo, atraso, exclusão |

Trocar o sistema inteiro por azul seria o caminho óbvio ao adotar a marca, e quebraria a
leitura construída em cada tela: **aqui o verde não é decoração, é vocabulário.** Ele se
opõe ao vermelho num par que a pessoa lê sem pensar, e que aparece em cartão, tabela,
gráfico e badge.

**O anel de foco é azul pelo mesmo raciocínio.** Ele diz onde o teclado está, não se algo
deu certo: usar verde ali fazia a cor competir com o significado que ela tem no resto do
sistema. É um tom mais claro que o do símbolo, porque o azul da marca dá 3,5:1 sobre a
superfície do cartão e a norma exige 3:1 para indicador de foco. Passar raspando num item
de acessibilidade é o mesmo que não passar; o tom escolhido dá 5,2:1.

A regra que fica: cor com significado no domínio não é reaproveitável para identidade
visual. Se um dia a marca precisar dominar mais, o caminho é ampliar o azul em superfícies
neutras (fundos, bordas, destaques de navegação), nunca substituindo o par verde/vermelho.

---

## 14.9. Medir a cor na saída, não na fonte

O nome do perfil realçava em verde ao passar o mouse, contrariando a regra de §14.8. A
troca por azul parecia trivial e não foi, porque `--brand` não serve para texto: como cor
de superfície ele funciona, e como palavra escrita reprova por pouco no contraste.

Nasceu daí `--brand-legivel`, o mesmo azul mais claro, para texto. Ele existe separado de
`--ring` por significado, não por cor: os dois têm o mesmo valor hoje, mas respondem a
exigências diferentes (4,5:1 para texto, 3:1 para indicador de foco), e um mudar não deve
arrastar o outro.

O erro que valeu a lição foi outro. A primeira medição converteu `oklch` para sRGB à mão e
errou a conta, dizendo que o azul da marca dava 2,6:1 quando dá 4,28:1, e que o azul do
anel dava 3,73:1 quando dá 6,33:1. Confiando nela, a escolha teria sido um azul-céu quase
branco, resolvendo com folga um problema muito menor do que a conta anunciava, e trocando
a cor da marca por outra que já não a lembra.

**A regra que fica: medir sobre o CSS compilado, que é o que o navegador recebe.** A fonte
está em `oklch`, o navegador lê `lab()`, e há um hex de reserva; entre a intenção escrita e
o pixel exibido há uma conversão que não se confere de cabeça. O mesmo cálculo achou de
quebra um contraste reprovado no atalho "pular para o conteúdo", que ninguém veria porque
ele só aparece com o teclado.

| Onde | Antes | Agora |
|---|---|---|
| Nome do perfil (hover) | verde | 6,33:1 escuro, 7,94:1 claro |
| Cartão de projeto e chips (hover) | verde | azul da marca na borda |
| Links | verde | 7,15:1 escuro, 7,59:1 claro |
| Espera de aprovação e troca de senha | verde | azul: nenhuma das duas é sucesso |
| Pular para o conteúdo | verde | 7,15:1 escuro, 7,59:1 claro |

O verde ficou onde significa algo: depósito no histórico, projeto distribuído, barra de
progresso de meta. É a fronteira de §14.8 aplicada, e não uma troca de paleta.

## 14.9-B. O que é saldo, e como o dinheiro sai dele

A exposição é a soma dos lançamentos de caixa: depósito, retirada, rendimento, resultado de
trade e `other`, mais a posição em token revalorizada. **Não há outra fonte.**

Isso precisa estar escrito porque a ausência de outra fonte já foi esquecida. Uma mudança
tirou `trade_pnl` do saldo com a justificativa de que "o saldo real é conferido na
plataforma e lançado à parte". O lançamento à parte não existe: `balance_snapshots` foi
desenhada em §4.3-C, nunca implementada, e ficou na documentação parecendo pronta. O efeito
foi imediato e grande: uma venda de token de US$ 7.380, registrada como `trade_pnl`,
desapareceu do saldo sem ter saído da conta. Revertido no mesmo dia.

A regra que vale, e que a legenda do campo agora diz em voz alta:

> Lucro soma ao saldo, prejuízo desconta, e os dois entram no resultado. Se você tirar o
> dinheiro da plataforma, isso é uma retirada.

**A simetria é o ponto**, e uma primeira redação a perdeu: ela dizia que só a retirada
tirava dinheiro da exposição. Não é verdade, e não deveria ser. Se lucro aumenta o saldo,
prejuízo tem de diminuí-lo na mesma medida, porque o dinheiro perdido operando não está mais
na plataforma. A retirada é para o dinheiro que sai **inteiro**, não para o que foi perdido.

É por isso que `direcaoDoTipo` devolve `ambos` para `trade_pnl` e o sinal digitado não é
forçado, ao contrário de depósito e retirada, que têm direção conhecida e levam o sinal
imposto por `aplicarSinalDoTipo`. Quatro testes fixam a simetria, incluindo a igualdade do
desvio para cima e para baixo.

`fee_gas` continua sendo a exceção legítima: ele sai do bolso, não da posição, e por isso
desconta do resultado sem nunca ter entrado no saldo.

## 14.10. A meta é dona do próprio progresso

Até aqui o progresso de uma meta era derivado: `volume_usd` somava todo o
`volume_traded` do projeto, filtrado pela conta quando a meta tinha uma.
Funcionava com uma meta e ruía com duas, porque as duas somavam a mesma coisa.
Um projeto com metas de perps, ponte e spot mostrava o mesmo número nas três, que
não era o de nenhuma.

A alternativa a lançar na meta seria o lançamento dizer a que meta pertence. Dá
o mesmo trabalho de digitação e espalha a regra por duas tabelas: um lançamento
sem meta some do progresso sem aviso, e um lançamento de volume que serve a duas
metas obrigaria a escolher uma. `goal_entries` já existia no schema para isso,
escrita e nunca usada.

Três consequências que a mudança carrega:

- **O valor soma, não substitui.** A pergunta que a pessoa se faz é "quanto rodei
  agora", não "quanto tenho no total": a segunda obrigaria a refazer a conta de
  cabeça a cada lançamento.
- **Negativo é aceito**, para corrigir um lançamento a mais sem apagar e refazer.
- **`goal_entries` não tem `user_id`.** Pende de `goals`, que tem. As ações
  conferem o dono por um SELECT em `goals` antes de escrever, e o DELETE filtra
  pelas metas do usuário: sem isso, conhecer o uuid de uma meta alheia bastaria
  para escrever nela.

As metas que já existiam foram semeadas com um lançamento igual ao progresso que
exibiam ([`scripts/semear-progresso-de-metas.ts`](scripts/semear-progresso-de-metas.ts)),
para o número não sumir da tela sem nada ter acontecido. `balance_usd` ficou de
fora: vinha da exposição, que revaloriza posição em token pela cotação do dia, e
congelar isso gravaria como progresso permanente o que era uma foto.

## 14.11. Erro do banco traduzido, sem repassar o banco

O `catch` das ações devolvia sempre "Não foi possível salvar. Tente de novo.",
e a frase só ajuda quando tentar de novo funciona. Agora
[`lib/erros-do-banco.ts`](lib/erros-do-banco.ts) mapeia o nome da constraint para
uma frase escrita à mão e devolve junto o campo, para o erro aparecer embaixo
dele em vez de num aviso solto.

A chave é o nome da constraint, não o texto da mensagem: o nome está em
`db/schema.ts` e só muda por migração, enquanto o texto muda com a versão e o
idioma do Postgres. O que não está na lista continua genérico, e **nenhuma frase
repassa texto do banco**, que era a razão de o genérico existir. Um teste
percorre todas as combinações de código e constraint procurando vazamento de
nome de tabela, valor colidido ou id de usuário.

**O Drizzle embrulha o erro do driver.** Ele lança `Error("Failed query: …")` e
pendura o original em `cause`, então `erro.code` no nível de fora é `undefined`.
A tradução percorre a cadeia. Esse detalhe custou uma rodada inteira de testes
verdes sobre um módulo que não funcionava: ver o Marco 38 do DEVLOG.

## 15. Consumo do banco: o que medir antes de otimizar

Medição de 12/08/2026, com um usuário real e a conta de demonstração:

| | Valor |
|---|---|
| Compute | 3,23 de 100 CU-hrs (3%) |
| Storage | 0,07 de 0,5 GB (14%) |
| Banco inteiro, por branch | 8,7 MB |
| **Só as tabelas do aplicativo** | **~750 kB** |

**O storage é dominado por estrutura, não por dados.** Cada branch Postgres nasce com uns
8 MB de catálogo do sistema, tipos e extensões, mesmo vazio; com dois branches, isso é pago
duas vezes. Os dados de verdade não chegam a 1 MB.

Consequência registrada para não ser esquecida: **limitar o histórico do usuário não
economizaria nada**. Apagar todos os lançamentos derrubaria o storage em menos de 2%, e a
restrição custaria a confiança de quem depende do histórico. A ideia foi levantada e
descartada com base nesta medição.

### 15.1. O desperdício que existe de verdade

Cada navegação dispara cerca de 17 consultas, no layout raiz, mesmo em telas que usam parte
dos dados:

| Origem | Consultas |
|---|---|
| `carregarDataset` | 10 |
| `materializarOcorrencias` | 5 |
| `carregarUsuario` | 1 |
| Contador de suporte (admin) | 1 |

Com 3% de compute isso não incomoda. Com dezenas de pessoas navegando, incomoda. Três
correções, da mais barata para a mais estrutural:

**1. Materializar no máximo uma vez por hora, por usuário.** Hoje as 5 consultas rodam a
cada clique só para concluir que não há nada a criar. Basta guardar o instante da última
materialização e sair cedo.

**2. Materializar o que a tela mostra.** A janela cria 30 dias à frente e a lista exibe
apenas a próxima ocorrência de cada tarefa (§ tarefas): as outras 29 são linhas que ninguém
vê. Materializar por contagem (as próximas N de cada tarefa) em vez de por janela de dias
resolve, e serve igual para recorrência diária e mensal, que hoje precisam de janelas
diferentes.

**3. Carregar por rota, não tudo no layout.** O `Dataset` inteiro é montado em toda
navegação porque o provider o expõe a todas as telas. É a mudança de maior alcance e a de
maior risco: mexe na fronteira que fez a troca de fixtures por Postgres custar um arquivo.
Fica para quando as duas primeiras não bastarem.

### 15.2. O que foi corrigido

As duas primeiras correções entraram, com resultado medido:

| | Antes | Depois |
|---|---|---|
| Ocorrências (produção) | 279 | 88 |
| Ocorrências (dev) | 3.237 | 176 |
| Tabela em dev | 760 kB | 64 kB |
| Consultas por navegação, caso comum | ~17 | ~13 |

**A marca de materialização** (`users.ocorrencias_em`) faz o motor recalcular no máximo de
hora em hora. Antes, cinco consultas rodavam a cada clique para concluir que nada havia
mudado, o que é o caso quase sempre: uma tarefa diária não ganha ocorrência nova entre duas
navegações.

**A contagem no lugar da janela** resolveu dois defeitos opostos que a janela de trinta dias
tinha ao mesmo tempo. Para uma tarefa diária, criava trinta linhas enquanto a tela mostra
uma. Para uma mensal, mal alcançava a ocorrência seguinte. Contar ocorrências dá três dias
na diária e três meses na mensal, que é o que "as próximas três" significa em cada caso.

`scripts/limpar-ocorrencias-futuras.ts` fez a limpeza única do que já estava no banco,
preservando atrasadas e concluídas. Depois dela, a tela de tarefas exibia exatamente os
mesmos números: as 3.061 linhas removidas eram invisíveis.

A terceira correção, **carregar por rota**, fica registrada e não foi feita. A condição para
mexer nela: quando as duas primeiras não bastarem, porque ela altera a fronteira que fez a
troca de fixtures por Postgres custar um arquivo só, e esse é o ativo arquitetural mais
valioso do projeto.

### 15.3. Recuperar o acesso de administrador

O administrador é o único sem saída pela interface, e isso é consequência direta de uma
decisão de segurança: `redefinirSenhaDeMembro` recusa gerar senha para contas admin, senão
quem administra poderia assumir a conta de outro administrador. O efeito colateral é que
**ninguém pode gerar a sua**.

Dois caminhos levam ao problema: esquecer a senha, ou restaurar um backup, que não guarda
hashes e apaga a senha de todos, inclusive a de quem vai restaurar.

`npm run admin:liberar -- --confirmar` **apaga o hash** em vez de definir uma senha nova. A
diferença importa: uma conta sem hash pode ser reivindicada pela tela de cadastro com o
mesmo e-mail, usando o fluxo que já existe e pelo qual a conta semeada virou conta de
verdade. Gerar senha no script a colocaria no histórico do terminal, que é o lugar errado
para ela.

**A janela de risco é real e assumida.** Entre apagar o hash e recadastrar, quem souber o
e-mail pode reivindicar a conta pela mesma tela. Por isso o script insiste em fazer o
recadastro imediatamente, e por isso ele exige acesso ao `DATABASE_URL`: quem já o tem,
já podia tudo.

Ordem de recuperação depois de um desastre, na sequência que funciona:

1. `npm run db:migrate` (a estrutura vem das migrações no git)
2. `npm run backup:restaurar` (os dados vêm do arquivo)
3. `npm run admin:liberar` e recadastro pela tela (o seu acesso)
4. Senhas temporárias na tela de membros (o acesso dos demais)

### 15.4. Exportar os dados, e por que não é sobre custo

Registrado como funcionalidade futura: **exportar tudo, não só o histórico**. Projetos,
contas, lançamentos, tarefas, metas, pontos e recebimentos, num formato que possa ser lido
fora daqui e reimportado.

O motivo não é economia de espaço, e isso importa para não desenhar errado: os dados de um
usuário ocupam menos de 1 MB (§15). Exportar existe por **confiança**, que é outro
requisito e leva a outro desenho:

| Se fosse por custo | Sendo por confiança |
|---|---|
| Exportar e **apagar** do sistema | Exportar e **manter** tudo no lugar |
| Só o histórico antigo | Tudo, inclusive o que está em uso |
| Formato compacto qualquer | Formato legível e reimportável |

Quem coloca dados financeiros num sistema quer poder tirá-los sem pedir nada a ninguém, e
saber que a saída existe é o que torna aceitável colocá-los ali.

Duas decisões a tomar quando for implementar: um arquivo único (JSON, que preserva a
estrutura e volta inteiro) ou vários CSVs (que abrem no Excel e no Sheets, e por isso são
mais úteis para quem só quer conferir). E se a reimportação faz parte do escopo, porque
exportação sem volta é backup, não portabilidade.

### 15.5. O que a medição ensina

O gargalo suposto era o histórico do usuário, e o real é a estrutura fixa mais a quantidade
de consultas por navegação. Nenhum dos dois apareceria sem medir por tabela e contar as
consultas.

Vale como método: **antes de otimizar, medir onde o custo está**. A intuição apontou para os
dados, que são menos de 1 MB.

---

## 16. Auditoria de segurança antes da divulgação

Feita quando o projeto deixou de ser uso próprio e passou a ser mostrado a quem não
conhece o código. Muda a pergunta: não é mais "eu consigo quebrar isso sem querer?", e sim
"o que alguém consegue fazer de propósito?".

### 16.1. O que já estava certo

Verificado contra o banco de produção, não só lido no código:

| Item | Como foi conferido | Resultado |
|---|---|---|
| Isolamento entre contas | `UPDATE`/`DELETE` com id real de outra pessoa | 0 linhas afetadas |
| `user_id` em toda tabela de dados | varredura do schema | nenhuma exceção |
| Senhas | bcrypt custo 12, inclusive na demo | sem exceção |
| Segredo no pacote do cliente | busca por `DATABASE_URL`/`AUTH_SECRET` no build | nada |
| Injeção de SQL | toda consulta por Drizzle ou `sql` parametrizado | nenhuma concatenação |
| Rotas de administração | requisição direta sem sessão e com sessão comum | 307 nas duas |
| Cookie de sessão | inspeção dos atributos | `HttpOnly`, `Secure`, `SameSite` |

O que sustenta a primeira linha está em `actions/_core.ts`: `userId` vem da sessão, e todo
`UPDATE`/`DELETE` filtra por ele além do id do registro. Como efeito colateral, id
inexistente e id alheio ficam indistinguíveis, que é o desejado.

### 16.2. Três defeitos encontrados

**1. `contarNaoLidos` era exportada de um arquivo `"use server"` sem checar papel.**
Toda função exportada desses arquivos vira endpoint acessível por requisição direta, e não
adianta a tela só chamá-la para quem administra. Ela devolvia quantos relatos de suporte
existiam por aí, para qualquer pessoa logada. Ganhou a checagem de papel dentro da própria
função. **A lição que fica:** em Server Action, a autorização mora na ação, nunca em quem
a chama.

**2. Faltavam cabeçalhos de segurança.** Sem `X-Frame-Options`/`frame-ancestors`, outro
site pode embutir o sistema num iframe invisível e capturar cliques de quem está logado.
Num app onde um clique aprova membro ou apaga projeto, era o buraco mais sério da lista.
Resolvido em `next.config.ts`, que também fecha *sniffing* de tipo, vazamento de URL pelo
`Referer` e acesso a câmera, microfone e localização.

Uma CSP completa ficou de fora, e a ausência é deliberada: sem *nonce* por requisição ela
quebra a hidratação do Next, e liberar `unsafe-inline` para não quebrar não protege quase
nada. Fica registrado como próximo passo, não como esquecimento.

**3. O "esqueci minha senha" dizia quem tinha conta.** A resposta era sempre igual, exceto
quando já havia um pedido nas últimas 24h: aí vinha "já existe um pedido em andamento".
Como só quem tem conta chega a ter pedido anterior, bastava enviar o mesmo endereço duas
vezes e ler a segunda resposta. O comentário no código chegava a justificar a diferença
("aqui a conta certamente existe, não há o que proteger"), com o raciocínio invertido: era
justamente isso que vazava. Agora o pedido repetido não cria linha e devolve a frase de
sempre.

### 16.3. Limite de tentativas de login

Não havia nenhum: seis senhas erradas seguidas eram seis tentativas processadas. Com a
senha sendo a única barreira, isso é força bruta sem custo.

Agora cinco falhas em quinze minutos bloqueiam o endereço pelo resto da janela. Quatro
decisões dentro disso:

- **A recusa por bloqueio é idêntica à recusa por senha errada.** Dizer "bloqueado"
  confirmaria que aquele endereço existe, que é a informação que a recusa única esconde.
- **A falha é contada mesmo quando o e-mail não existe.** Contar só os cadastrados faria o
  próprio limite virar o oráculo que a mensagem única evita.
- **O bloqueio é por e-mail, não por IP.** O custo é conhecido: dá para travar a conta de
  outra pessoa por quinze minutos de propósito. Aceito porque a alternativa protege menos.
  IP em *serverless* chega por cabeçalho, que o cliente influencia, e um ataque distribuído
  troca de IP a cada tentativa enquanto o e-mail alvo continua o mesmo.
- **A demonstração fica de fora.** A senha dela está publicada no README, então não há o
  que descobrir por tentativa e erro, e limitá-la só criaria um jeito barato de derrubar a
  vitrine: cinco erros de propósito e a demo passa quinze minutos recusando visitante.

A decisão vive em `lib/limite-login.ts`, pura e recebendo o instante atual; o banco só
entrega os carimbos de tempo, em `db/queries/tentativas.ts`. A separação existe para a
regra ser testável sem subir Postgres, e os sete testes cobrem as bordas que importam:
uma falha antes do limite, a falha que fecha, a janela que expira e as falhas velhas que
não podem completar a conta de uma nova.

A tabela se limpa sozinha: cada falha registrada apaga o que passou de quatro janelas.
Sem isso ela cresceria para sempre guardando tentativas que já não decidem nada.

### 16.4. Limites conhecidos, assumidos

- **O cadastro confirma se um e-mail já tem conta.** Foi decisão explícita (§14): quem
  tentava recadastrar não entendia o silêncio. Com o sistema exposto, isso permite mapear
  membros testando endereços. Continua valendo enquanto o grupo for fechado e pequeno.
- **Não há limite de cadastros novos.** Um script pode encher a fila de aprovação. Conter
  isso exigiria limite por IP, que aqui protege pouco pelo motivo de §16.3, e o caminho
  melhor é regra de *firewall* na borda: configuração de infraestrutura, não código.
- **A demo é pública e gravável.** Quem entrar pode bagunçar os dados dela, e é assim de
  propósito, porque uma demonstração só de leitura não demonstra nada. `npm run
  demo:restaurar -- --producao` devolve senha e dados originais.

## 17. Fora de escopo (registrado para depois)

- Leitura on-chain automática de saldos (Alchemy/DeBank).
- Integração com CEX via API key.
- Multi-moeda com cotação automática.
- Checklist de critérios de elegibilidade por conta.
- Notificações (Discord/e-mail) de tarefa vencendo.
- **Paginação e carregamento sob demanda.** Hoje o Dataset inteiro é carregado numa
  requisição. Adequado a dezenas de projetos e centenas de lançamentos; deixa de ser quando
  o histórico crescer. É a lacuna técnica mais relevante do projeto hoje.
- **Upload de arquivo.** Nada aqui lida com armazenamento de binário. Seria o caminho para
  anexar print a um relato de bug (§14.6).
- **Busca no histórico.** Não há como procurar um lançamento por texto, o que passa a doer
  junto com o crescimento que motiva a paginação.
- **Atualização em tempo real.** Nenhuma tela usa websocket ou polling; tudo depende de
  recarregar. Só se justifica se mais de uma pessoa passar a mexer nos mesmos dados.
- **Internacionalização.** Idioma selecionável levando junto data, separador de milhar e
  moeda. Um detalhe que decide a implementação: `<input type="date">` exibe no formato da
  preferência do navegador, não da página, e isso não é configurável por HTML. Só um
  seletor de data próprio daria controle total, ao custo de perder calendário do sistema,
  navegação por teclado e teclado numérico no celular.
- **Tempo de capital depositado.** Hoje o sistema sabe quanto está parado, não há quanto
  tempo. "$500 por um mês" e "$500 por seis meses" pesam muito diferente para decidir onde
  alocar, e nenhuma tela distingue os dois. Exigiria medir a posição ao longo do tempo, com
  depósitos e saques parciais, e não apenas o saldo atual.
