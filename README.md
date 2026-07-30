# airdrop-tracker

Controle de farming de airdrops: quanto foi investido, o que precisa ser feito hoje e qual
o resultado — por projeto e por conta.

Substitui uma planilha onde depósito e saldo dividiam a mesma coluna, o que tornava
qualquer somatório incorreto. A separação entre **fluxo de caixa** e **foto de saldo** é a
decisão central do modelo de dados.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Linguagem | TypeScript (strict) |
| Banco | PostgreSQL serverless (Neon) |
| ORM | Drizzle |
| Validação | Zod |
| UI | Tailwind v4 + shadcn/ui (Radix) |
| Gráficos | Recharts |
| Testes | Vitest |
| Deploy | Vercel |

## Estado do projeto

A interface está completa e navegável, **rodando sem backend**: os dados vêm de fixtures
e tudo que você cadastra fica no `localStorage` do navegador. Dá para criar, editar e
excluir projetos, contas, lançamentos, saldos, tarefas, metas e pontos.

Os projetos e valores que aparecem são **dados de demonstração**, não reais.

O banco entra na fase seguinte. A agregação já está isolada em funções puras
(`lib/selectors`, `lib/mutations`) que não sabem de onde vêm os dados, então a troca por
Drizzle + Neon não altera regra de negócio nem nenhuma tela — ver
[`ARCHITECTURE.md`](ARCHITECTURE.md) §10.

## Começando

```bash
npm install
npm run dev          # http://localhost:3000
```

Nada além disso é necessário enquanto o backend não entra. Para a fase de banco:

```bash
cp .env.example .env.local     # preencha DATABASE_URL com a string do Neon
npm run db:push                # cria as tabelas
npm run db:seed                # cria o usuário local e imprime o SEED_USER_ID
# cole o SEED_USER_ID em .env.local
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run check` | Typecheck sem emitir |
| `npm test` | Suíte Vitest |
| `npm run test:watch` | Vitest em modo watch |
| `npm run db:push` | Aplica o schema no banco |
| `npm run db:generate` | Gera arquivos de migração |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Cria o usuário local |

## Estrutura

```
app/         Rotas (Server Components por padrão)
actions/     Server Actions — toda escrita passa por aqui
db/
  schema.ts  Definição das tabelas (Drizzle)
  queries/   Leitura e agregação — toda leitura passa por aqui
lib/         Funções puras: money, recurrence, csv-parser, validators
components/  UI (shadcn em components/ui)
tests/       Vitest
```

Duas regras de fronteira:

1. Nenhum componente chama Drizzle diretamente — leitura via `db/queries`, escrita via
   `actions/`.
2. Todo arquivo em `db/` e `lib/env.ts` começa com `import "server-only"`, o que
   transforma um import acidental no cliente em erro de build em vez de vazamento da
   string de conexão no bundle.

## Documentação

| Documento | O que traz |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Como o sistema é: modelo de dados, fórmulas financeiras, motor de recorrência, fluxo de importação, autorização e decisões registradas |
| [`DEVLOG.md`](DEVLOG.md) | Como se chegou até aqui: trade-offs considerados, alternativas descartadas e os bugs encontrados no caminho |

## Estado

Fase 0 concluída (infraestrutura). Fase 1 em seguida — ver §10 do ARCHITECTURE.md.
