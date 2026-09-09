/**
 * Remapeia `projects.priority` da escala antiga (1 a 5) para a nova (1 a 3).
 *
 *   npx tsx scripts/remapear-prioridade.ts              # dev, só relata
 *   npx tsx scripts/remapear-prioridade.ts --confirmar
 *   npx tsx scripts/remapear-prioridade.ts --producao --confirmar
 *
 * Mapa: {1,2} -> 1 (baixa), {3} -> 2 (média), {4,5} -> 3 (alta). Preserva a
 * posição relativa na escala velha: quem estava no meio (3, o padrão de
 * quem nunca escolheu) continua no meio (2), e quem estava nos extremos
 * continua nos extremos.
 *
 * Não toca em `catalog_projects.priority`: a coluna nasceu agora, com
 * `default 2`, e não tem valor antigo para remapear.
 */
import { neon } from "@neondatabase/serverless";

import { anunciar, resolverAmbiente } from "./_ambiente";

const ambiente = resolverAmbiente();
const sql = neon(ambiente.url);
const confirmado = process.argv.includes("--confirmar");

const MAPA: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 };

async function main() {
  anunciar(ambiente);

  const linhas = (await sql`
    select id, name, priority from projects order by priority
  `) as { id: string; name: string; priority: number }[];

  const porValorAntigo = new Map<number, number>();
  for (const l of linhas) {
    porValorAntigo.set(l.priority, (porValorAntigo.get(l.priority) ?? 0) + 1);
  }

  console.log("\n  antigo -> novo   quantos");
  for (const [antigo, quantos] of [...porValorAntigo].sort((a, b) => a[0] - b[0])) {
    const novo = MAPA[antigo] ?? 2;
    console.log(`  ${String(antigo).padStart(6)} -> ${novo}      ${quantos}`);
  }

  const foraDoMapa = linhas.filter((l) => !(l.priority in MAPA));
  if (foraDoMapa.length > 0) {
    console.log(
      `\n!! ${foraDoMapa.length} projeto(s) com prioridade fora de 1-5, vão para 2 (médio):`,
    );
    for (const l of foraDoMapa) console.log(`   ${l.name}: ${l.priority}`);
  }

  if (!confirmado) {
    console.log("\nNada foi gravado. Repita com --confirmar.");
    return;
  }

  for (const l of linhas) {
    const novo = MAPA[l.priority] ?? 2;
    await sql`update projects set priority = ${novo} where id = ${l.id}`;
  }

  const depois = (await sql`
    select priority, count(*)::int as n from projects group by priority order by priority
  `) as { priority: number; n: number }[];

  const invalido = depois.some((d) => d.priority < 1 || d.priority > 3);
  console.log(`\n${linhas.length} projetos atualizados.`);
  console.log(
    invalido
      ? "!! algum projeto ficou fora de 1-3. Restaure o backup e investigue."
      : "Conferido: toda prioridade está entre 1 e 3.",
  );
}

main().then(() => process.exit(0));
