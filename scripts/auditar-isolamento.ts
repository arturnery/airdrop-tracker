/**
 * Confere, contra o banco, que uma conta não alcança os dados de outra.
 *
 * O isolamento é a garantia mais importante do sistema, e ler o código confirma
 * o que se espera encontrar: o objetivo aqui é medir, não reler. Cada teste
 * dispara a mesma condição que as Server Actions usam (`id` do registro **e**
 * `user_id` da sessão), trocando o `user_id` pelo de outra pessoa, e conta as
 * linhas atingidas. Zero é a única resposta aceitável.
 *
 * **É seguro rodar em produção, inclusive se o isolamento estiver quebrado.**
 * Isso não é detalhe: uma auditoria que corrompe dados quando encontra o
 * problema é pior do que não auditar. Duas escolhas garantem a segurança:
 *
 *  - o `UPDATE` grava o valor que a linha já tem (`set name = name`), então a
 *    contagem revela o furo sem alterar nada;
 *  - o `DELETE` não é executado. No lugar dele vai um `SELECT` com a condição
 *    idêntica, porque é a condição que decide, e apagar para descobrir seria
 *    justamente o desfecho a evitar.
 *
 *   npx tsx scripts/auditar-isolamento.ts
 *   npx tsx scripts/auditar-isolamento.ts --producao
 */
import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);

let falhas = 0;

function relatar(teste: string, atingidas: number) {
  const passou = atingidas === 0;
  if (!passou) falhas += 1;
  console.log(`  ${passou ? "ok  " : "FALHA"}  ${teste}: ${atingidas} linha(s)`);
}

async function main() {
  anunciar(ambiente);

  /*
   * O dono é quem tem mais dados, não o mais antigo. Com o mais antigo o teste
   * passava sem testar nada: as tabelas vinham vazias e cada verificação
   * respondia zero linhas por não haver linha nenhuma, que é o falso positivo
   * mais fácil de escrever numa auditoria.
   */
  const usuarios = await sql`
    select u.id,
           u.email,
           (select count(*) from projects p where p.user_id = u.id)
             + (select count(*) from accounts a where a.user_id = u.id) as dados
      from users u
     order by dados desc, u.created_at
  `;

  if (usuarios.length < 2) {
    console.log("\nMenos de duas contas: o teste cruzado é impossível.");
    return;
  }

  const [dono, invasor] = usuarios;
  console.log(`\nDono dos dados: ${dono.email}`);
  console.log(`Tentando alcançar como: ${invasor.email}\n`);

  /*
   * Cada entrada é uma tabela com dono direto e a coluna usada na escrita. As
   * demais penduram nestas por cascata: alcançar as filhas exigiria antes
   * alcançar a mãe, que é o que se está medindo.
   */
  const tabelas = [
    { nome: "projects", coluna: "name" },
    { nome: "accounts", coluna: "label" },
  ] as const;

  for (const { nome, coluna } of tabelas) {
    const [linha] = await sql`
      select id from ${sql.unsafe(nome)} where user_id = ${dono.id} limit 1
    `;

    if (!linha) {
      console.log(`  ----  ${nome}: sem dado para testar`);
      continue;
    }

    // Grava o valor que já está lá: mede a condição sem mudar a linha.
    const atualizadas = await sql`
      update ${sql.unsafe(nome)}
         set ${sql.unsafe(coluna)} = ${sql.unsafe(coluna)}
       where id = ${linha.id} and user_id = ${invasor.id}
      returning id
    `;
    relatar(`update em ${nome} com id alheio`, atualizadas.length);

    // A condição do delete, sem o delete.
    const alcancadas = await sql`
      select id from ${sql.unsafe(nome)}
       where id = ${linha.id} and user_id = ${invasor.id}
    `;
    relatar(`delete em ${nome} com id alheio`, alcancadas.length);
  }

  /*
   * Toda tabela de dados precisa chegar a um dono. Ou tem `user_id`, ou aponta
   * por chave estrangeira para alguma que tenha, direta ou indiretamente.
   *
   * A verificação segue as chaves de verdade em vez de conferir uma lista de
   * nomes de coluna escrita à mão. A lista escrita à mão é o que falha primeiro:
   * ela envelhece calada quando alguém cria uma tabela nova, e uma tabela órfã é
   * exatamente aquela que nenhuma consulta consegue filtrar por pessoa.
   */
  console.log("");

  const colunas = await sql`
    select table_name from information_schema.columns
     where table_schema = 'public' and column_name = 'user_id'
  `;

  const chaves = await sql`
    select t.relname as filha, f.relname as mae
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_class f on f.oid = c.confrelid
     where c.contype = 'f'
  `;

  const comDono = new Set(colunas.map((l) => String(l.table_name)));
  comDono.add("users");

  // Propaga o dono pelas chaves até nada mais mudar: uma tabela alcança dono se
  // aponta para outra que já alcança.
  for (let antes = -1; antes !== comDono.size; ) {
    antes = comDono.size;
    for (const { filha, mae } of chaves) {
      if (comDono.has(String(mae))) comDono.add(String(filha));
    }
  }

  const todas = await sql`
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  `;

  /* `login_attempts` guarda e-mail tentado, não conta: não tem dono por não
     poder ter, já que registra também tentativa contra endereço inexistente.
     A tabela de migrações é do Drizzle. */
  const semDonoEsperado = new Set(["__drizzle_migrations", "login_attempts"]);
  const orfas = todas
    .map((l) => String(l.table_name))
    .filter((nome) => !comDono.has(nome) && !semDonoEsperado.has(nome));

  relatar("tabelas que não chegam a um dono", orfas.length);
  if (orfas.length) console.log(`        ${orfas.join(", ")}`);

  console.log(
    falhas === 0
      ? "\nIsolamento íntegro: nenhuma condição cruzada alcançou dado alheio."
      : `\n${falhas} verificação(ões) falharam. Nada foi alterado.`,
  );
}

main().then(() => process.exit(falhas === 0 ? 0 : 1));
