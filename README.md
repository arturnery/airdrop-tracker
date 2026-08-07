# airdrop-tracker

Controle de farming de airdrops: quanto foi investido, o que precisa ser feito hoje e qual
o resultado: por projeto e por conta.

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

Aplicação funcional com banco e autenticação. Cada pessoa entra com e-mail e senha e vê
apenas os próprios projetos, contas, lançamentos e tarefas. Cadastros novos ficam
pendentes até serem liberados na área de administração.

Os projetos e valores dos dados de demonstração são fictícios.

## Começando

```bash
npm install
cp .env.example .env.local     # preencha DATABASE_URL, AUTH_SECRET e ADMIN_EMAIL
npm run db:migrate             # cria as 14 tabelas
npm run db:seed                # cria a conta de administrador
npm run db:seed-demo           # opcional: carrega dados de exemplo
npm run dev                    # http://localhost:3000
```

A senha do administrador é definida por você no primeiro cadastro, pela tela. Quem se
cadastrar com o e-mail de `ADMIN_EMAIL` nasce admin e aprovado; qualquer outro e-mail
entra na fila de aprovação.

## Ambientes

Produção e desenvolvimento usam bancos diferentes. São dois branches do mesmo projeto
Neon: `main` serve produção, `dev` serve a máquina local.

| | Produção | Desenvolvimento |
|---|---|---|
| Banco | Branch `main` | Branch `dev` |
| Onde a conexão fica | Variáveis do projeto na Vercel | `.env.local`, fora do versionamento |
| Dados | Reais | `npm run db:seed-demo`, fictícios |
| Segredo de sessão | Próprio, gerado para produção | Próprio, local |

Desenvolvimento não recebe cópia de produção. Assim que houver mais de uma pessoa usando o
sistema, produção passa a guardar e-mails e hashes de senha de terceiros, e clonar isso
para onde se testa migração espalharia dado de outra pessoa sem que ela tenha concordado.

**O `.env.local` não muda de valor no dia a dia.** Ele aponta para `dev` e fica assim.
Para os casos raros de rodar um script administrativo contra produção, os scripts aceitam
`--producao`, que lê a conexão de `.env.production.local`:

```bash
npx tsx scripts/limpar-dados.ts                          # dev, só relata
npx tsx scripts/limpar-dados.ts --confirmar              # dev, apaga
npx tsx scripts/limpar-dados.ts --producao --confirmar   # produção, apaga
```

A escolha fica na linha que foi digitada, em vez de num arquivo editado e esquecido, e o
padrão é sempre o ambiente descartável. Todo script imprime o ambiente e o host antes de
agir, com `!!` quando o alvo é produção.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run check` | Typecheck sem emitir |
| `npm test` | Suíte Vitest |
| `npm run test:watch` | Vitest em modo watch |
| `npm run db:migrate` | Aplica as migrações no banco |
| `npm run db:generate` | Gera uma migração a partir do schema |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Cria a conta de administrador |
| `npm run db:seed-demo` | Carrega dados de demonstração |
| `npx tsx scripts/limpar-dados.ts` | Mostra o que uma limpeza apagaria (some `--confirmar` para apagar): preserva as contas de acesso |

## Estrutura

```
app/         Rotas (Server Components por padrão)
actions/     Server Actions: toda escrita passa por aqui
db/
  schema.ts  Definição das tabelas (Drizzle)
  queries/   Leitura e agregação: toda leitura passa por aqui
lib/         Funções puras: money, recurrence, csv-parser, validators
components/  UI (shadcn em components/ui)
tests/       Vitest
```

Duas regras de fronteira:

1. Nenhum componente chama Drizzle diretamente: leitura via `db/queries`, escrita via
   `actions/`.
2. Todo arquivo em `db/` e `lib/env.ts` começa com `import "server-only"`, o que
   transforma um import acidental no cliente em erro de build em vez de vazamento da
   string de conexão no bundle.

## Documentação

| Documento | O que traz |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Como o sistema é: modelo de dados, fórmulas financeiras, motor de recorrência, fluxo de importação, autorização e decisões registradas |
| [`DEVLOG.md`](DEVLOG.md) | Como se chegou até aqui: trade-offs considerados, alternativas descartadas e os bugs encontrados no caminho |

## Segurança

Três decisões que valem registro:

- **Senha nunca é guardada**, só o hash (bcrypt custo 12). Nem com acesso ao banco é
  possível recuperá-la.
- **A recusa de login é sempre a mesma mensagem**, seja senha errada, e-mail inexistente
  ou conta não aprovada. Distinguir os casos transformaria a tela num verificador de quem
  tem conta.
- **Todo UPDATE e DELETE filtra por usuário** além do id do registro, então conhecer um
  uuid alheio não permite alterá-lo.
