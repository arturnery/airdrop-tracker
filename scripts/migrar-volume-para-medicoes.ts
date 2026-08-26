/**
 * Converte os lançamentos de volume em medições de volume acumulado.
 *
 * Volume deixou de ser fluxo e virou foto (§2): a plataforma mostra um total
 * que só cresce, e o ganho do período sai da diferença entre duas medições.
 * Os lançamentos antigos eram incrementos, então a conversão soma o acumulado
 * por par projeto×conta, em ordem de data.
 *
 * Exemplo, com três lançamentos de uma conta:
 *
 *   10/08  +2.000        vira  10/08   2.000   (primeira medição)
 *   11/08  +3.500        vira  11/08   5.500   (+3.500)
 *   14/08  +5.510        vira  14/08  11.010   (+5.510)
 *
 * **O total de cada projeto não muda**, e é essa a garantia que o script
 * confere antes e depois: a última medição de cada par tem de valer o mesmo que
 * a soma dos incrementos daquele par.
 *
 * Os lançamentos convertidos são apagados. Manter os dois seria gravar o mesmo
 * fato em duas tabelas, e a próxima pessoa a ler não saberia qual vale.
 *
 * Mais de um lançamento no mesmo dia, para o mesmo par, viram **uma** medição
 * com o acumulado do fim daquele dia: a tabela aceita uma por par por dia, e o
 * acumulado do dia é o que a plataforma teria mostrado à noite.
 *
 *   npx tsx scripts/migrar-volume-para-medicoes.ts              # dev, só relata
 *   npx tsx scripts/migrar-volume-para-medicoes.ts --confirmar
 *   npx tsx scripts/migrar-volume-para-medicoes.ts --producao --confirmar
 */
import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);
const confirmado = process.argv.includes("--confirmar");

type Linha = {
  id: string;
  user_id: string;
  project_id: string;
  account_id: string;
  projeto: string;
  conta: string;
  data: string;
  valor: number;
  descricao: string | null;
};

async function main() {
  anunciar(ambiente);

  const linhas = (await sql`
    select t.id, t.user_id, t.project_id, t.account_id,
           p.name as projeto, a.label as conta,
           t.occurred_at::text as data,
           t.amount_usd::float8 as valor,
           t.description as descricao
      from transactions t
      join projects p on p.id = t.project_id
      join accounts a on a.id = t.account_id
     where t.type = 'volume_traded'
     order by t.project_id, t.account_id, t.occurred_at, t.created_at
  `) as unknown as Linha[];

  if (linhas.length === 0) {
    console.log("\nNenhum lançamento de volume: nada a converter.");
    return;
  }

  const jaTem = await sql`select count(*)::int as n from volume_snapshots`;
  if (jaTem[0].n > 0) {
    console.log(
      `\n!! Já existem ${jaTem[0].n} medições de volume. O script para aqui:` +
        "\n   rodar de novo somaria em cima do que já foi convertido.",
    );
    return;
  }

  /*
   * Agrupa por par e por dia. O acumulado é o total do par até o fim de cada
   * dia, que é o número que a plataforma exibiria naquela data.
   */
  const porParEDia = new Map<
    string,
    { linha: Linha; acumulado: number; notas: string[] }
  >();
  const totalPorPar = new Map<string, number>();

  for (const l of linhas) {
    const par = `${l.project_id}::${l.account_id}`;
    const acumulado = (totalPorPar.get(par) ?? 0) + l.valor;
    totalPorPar.set(par, acumulado);

    const chave = `${par}::${l.data}`;
    const existente = porParEDia.get(chave);
    porParEDia.set(chave, {
      linha: l,
      acumulado,
      notas: [...(existente?.notas ?? []), l.descricao].filter(
        (n): n is string => Boolean(n),
      ),
    });
  }

  const medicoes = [...porParEDia.values()];
  console.log(
    `\n${linhas.length} lançamentos viram ${medicoes.length} medições ` +
      `em ${totalPorPar.size} pares projeto×conta.\n`,
  );

  const porProjeto = new Map<string, { medicoes: number; total: number }>();
  for (const [par, total] of totalPorPar) {
    const nome = linhas.find((l) => `${l.project_id}::${l.account_id}` === par)!.projeto;
    const atual = porProjeto.get(nome) ?? { medicoes: 0, total: 0 };
    porProjeto.set(nome, {
      medicoes: atual.medicoes + medicoes.filter((m) => `${m.linha.project_id}::${m.linha.account_id}` === par).length,
      total: atual.total + total,
    });
  }

  console.log("  projeto           medições   acumulado final");
  for (const [nome, d] of [...porProjeto].sort((a, b) => b[1].total - a[1].total)) {
    console.log(
      `  ${nome.padEnd(16)} ${String(d.medicoes).padStart(6)} ${d.total.toFixed(2).padStart(17)}`,
    );
  }

  if (!confirmado) {
    console.log("\nNada foi gravado. Repita com --confirmar.");
    return;
  }

  for (const m of medicoes) {
    await sql`
      insert into volume_snapshots (user_id, project_id, account_id, taken_at, volume_usd, note)
      values (${m.linha.user_id}, ${m.linha.project_id}, ${m.linha.account_id},
              ${m.linha.data}, ${m.acumulado.toFixed(2)},
              ${m.notas.length ? m.notas.join(" · ") : null})
    `;
  }

  const apagados = await sql`
    delete from transactions where type = 'volume_traded' returning id
  `;

  /*
   * Confere depois de gravar, e não só antes: o total de cada par tem de bater
   * com a soma dos incrementos que existiam. Uma migração que não se confere é
   * uma migração em que ninguém vai notar o erro.
   */
  const conferencia = await sql`
    select project_id, account_id, max(volume_usd)::float8 as acumulado
      from volume_snapshots group by project_id, account_id
  `;
  let divergentes = 0;
  for (const c of conferencia) {
    const esperado = totalPorPar.get(`${c.project_id}::${c.account_id}`) ?? 0;
    if (Math.abs(Number(c.acumulado) - esperado) > 0.005) divergentes += 1;
  }

  console.log(
    `\n${medicoes.length} medições gravadas, ${apagados.length} lançamentos removidos.`,
  );
  console.log(
    divergentes === 0
      ? "Conferido: o acumulado de cada par bate com a soma dos incrementos."
      : `!! ${divergentes} pares divergiram. Restaure o backup e investigue.`,
  );
}

main().then(() => process.exit(0));
