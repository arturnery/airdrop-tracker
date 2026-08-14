/**
 * Guarda o progresso que as metas exibiam antes de ele virar manual.
 *
 * Até aqui o progresso era derivado: uma meta de `volume_usd` somava todo o
 * `volume_traded` do projeto (ou da conta, quando a meta tinha uma). Isso ruía
 * com mais de uma meta no mesmo projeto, porque as duas somavam a mesma coisa, e
 * por isso o progresso passou a ser lançado meta a meta.
 *
 * Sem este script a mudança zeraria as metas existentes. Elas continuariam
 * corretas pela regra nova, e erradas para quem olha: o número que estava na
 * tela ontem some sem nada ter acontecido.
 *
 * Aqui cada meta recebe **um** lançamento com o valor que ela mostrava, marcado
 * na nota como o que é. Depois disso o histórico continua dela, e o que for
 * lançado soma por cima.
 *
 * Roda uma vez por ambiente. Rodar de novo não duplica: metas que já têm
 * lançamento são puladas.
 *
 *   npx tsx scripts/semear-progresso-de-metas.ts              # dev, só relata
 *   npx tsx scripts/semear-progresso-de-metas.ts --confirmar
 *   npx tsx scripts/semear-progresso-de-metas.ts --producao --confirmar
 */
import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);
const confirmado = process.argv.includes("--confirmar");

/** A data do lançamento semeado: o progresso é anterior a hoje, não de hoje. */
const HOJE = new Date().toISOString().slice(0, 10);

async function main() {
  anunciar(ambiente);

  const metas = await sql`
    select g.id,
           g.title,
           g.metric,
           g.account_id,
           g.project_id,
           p.name as projeto,
           (select count(*) from goal_entries e where e.goal_id = g.id)::int as ja_tem
      from goals g
      join projects p on p.id = g.project_id
     order by p.name, g.title
  `;

  if (metas.length === 0) {
    console.log("\nNenhuma meta cadastrada: nada a semear.");
    return;
  }

  let semeadas = 0;
  let puladas = 0;
  console.log("");

  for (const meta of metas) {
    if (meta.ja_tem > 0) {
      console.log(`  pula   ${meta.projeto} :: ${meta.title} (já tem lançamento)`);
      puladas += 1;
      continue;
    }

    const valor = await progressoDerivado({
      metric: String(meta.metric),
      project_id: String(meta.project_id),
      account_id: meta.account_id === null ? null : String(meta.account_id),
    });

    if (valor === 0) {
      console.log(`  pula   ${meta.projeto} :: ${meta.title} (progresso era zero)`);
      puladas += 1;
      continue;
    }

    console.log(
      `  semeia ${meta.projeto} :: ${meta.title} → ${valor.toFixed(2)}`,
    );

    if (confirmado) {
      await sql`
        insert into goal_entries (goal_id, occurred_at, value, note)
        values (${meta.id}, ${HOJE}, ${valor.toFixed(2)},
                'Progresso acumulado antes de o registro virar manual')
      `;
    }
    semeadas += 1;
  }

  console.log(
    confirmado
      ? `\n${semeadas} meta(s) semeada(s), ${puladas} pulada(s).`
      : `\n${semeadas} meta(s) seriam semeadas, ${puladas} puladas.` +
          "\nNada foi gravado: repita com --confirmar.",
  );
}

/**
 * Refaz a conta que os selectors faziam, exatamente como faziam.
 *
 * O SQL repete a regra antiga em vez de importar o código dela, e é de
 * propósito: a regra antiga está sendo apagada no mesmo commit. Importar
 * amarraria um script de uso único a uma função que deixou de existir.
 */
async function progressoDerivado(meta: {
  metric: string;
  project_id: string;
  account_id: string | null;
}): Promise<number> {
  const daConta = meta.account_id;

  if (meta.metric === "volume_usd") {
    const [linha] = await sql`
      select coalesce(sum(amount_usd), 0)::float8 as total
        from transactions
       where project_id = ${meta.project_id}
         and type = 'volume_traded'
         and (${daConta}::uuid is null or account_id = ${daConta}::uuid)
    `;
    return Number(linha.total);
  }

  if (meta.metric === "tx_count") {
    const [linha] = await sql`
      select count(*)::float8 as total
        from transactions
       where project_id = ${meta.project_id}
         and (${daConta}::uuid is null or account_id = ${daConta}::uuid)
    `;
    return Number(linha.total);
  }

  if (meta.metric === "days_active") {
    const [linha] = await sql`
      select count(distinct occurred_at)::float8 as total
        from transactions
       where project_id = ${meta.project_id}
         and (${daConta}::uuid is null or account_id = ${daConta}::uuid)
    `;
    return Number(linha.total);
  }

  /*
   * `balance_usd` fica de fora. O saldo vinha da exposição, que revaloriza
   * posição em token pela cotação do dia: congelá-lo num lançamento gravaria
   * como progresso permanente um número que era uma foto. Melhor a meta começar
   * vazia e a pessoa lançar o que quiser que conte.
   */
  return 0;
}

main().then(() => process.exit(0));
