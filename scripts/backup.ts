/**
 * Cópia de segurança dos dados, num arquivo legível fora daqui.
 *
 *   npm run backup                  # desenvolvimento
 *   npm run backup -- --producao    # produção
 *
 * É a única proteção contra perder dado. Nem o rollback da Vercel nem o git
 * alcançam o banco: apagar um projeto leva junto lançamentos, tarefas, metas e
 * pontos por cascata, e não há de onde voltar.
 *
 * **Senhas ficam de fora, de propósito.** Guardá-las economizaria os poucos
 * minutos de gerar senhas temporárias num desastre, e criaria um arquivo
 * sensível que se multiplica em cópias pelo Drive e por máquinas antigas
 * durante anos. Sem os hashes, o arquivo não dá acesso a nada mesmo se vazar,
 * e continua trazendo o que realmente dói perder: projetos, lançamentos,
 * tarefas, metas, pontos e recebimentos.
 *
 * Guarda **dados**, não estrutura. Restaurar num banco vazio exige
 * `npm run db:migrate` antes, e isso é aceitável porque a estrutura já tem
 * backup: são as migrações versionadas no git.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";
import { TABELAS } from "./_tabelas";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);


/** Colunas que nunca saem do banco. */
const OMITIR: Record<string, string[]> = {
  users: ["password_hash"],
};

async function main() {
  anunciar(ambiente);

  const dados: Record<string, unknown[]> = {};
  let total = 0;

  for (const tabela of TABELAS) {
    // `sql.query` é a via para SQL montado: a forma de template só aceita
    // literais, e o nome da tabela vem da constante acima, não de entrada.
    const linhas = (await sql.query(`select * from ${tabela}`)) as Record<
      string,
      unknown
    >[];

    const omitir = OMITIR[tabela] ?? [];
    dados[tabela] = linhas.map((linha) => {
      const copia = { ...linha };
      for (const coluna of omitir) delete copia[coluna];
      return copia;
    });

    total += linhas.length;
    console.log(`  ${tabela}: ${linhas.length}`);
  }

  /*
   * A migração atual vai junto porque diz contra qual estrutura este arquivo
   * foi feito. Sem ela, restaurar um backup antigo num banco novo falharia
   * apenas na hora, sem aviso.
   */
  const migracoes = (await sql.query(
    `select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`,
  )) as { hash: string }[];

  const arquivo = {
    versao: 1,
    geradoEm: new Date().toISOString(),
    ambiente: ambiente.nome,
    banco: ambiente.host,
    ultimaMigracao: migracoes[0]?.hash ?? null,
    contemSenhas: false,
    tabelas: dados,
  };

  mkdirSync("backups", { recursive: true });
  const nome = `backups/${ambiente.nome === "produção" ? "producao" : "dev"}-${
    new Date().toISOString().slice(0, 10)
  }.json`;
  writeFileSync(nome, JSON.stringify(arquivo, null, 2));

  console.log(`\n${total} linhas em ${nome}`);
  console.log(
    "Sem senhas: ao restaurar, gere temporárias na tela de membros.\n" +
      "Guarde uma cópia fora desta máquina, senão ela não protege contra perdê-la.\n",
  );
}

main().then(() => process.exit(0));
