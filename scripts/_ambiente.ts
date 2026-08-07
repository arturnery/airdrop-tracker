/**
 * Escolhe contra qual banco um script roda.
 *
 * O `.env.local` aponta para desenvolvimento e não muda: quem roda a aplicação
 * local sempre fala com o branch `dev`. Produção vive nas variáveis do projeto
 * na Vercel, que a máquina local não lê.
 *
 * Sobra um caso: rodar um script administrativo contra produção. A saída
 * ingênua seria editar o `.env.local` na hora e desfazer depois, e é justamente
 * aí que mora o acidente, porque é fácil esquecer o arquivo editado e o próximo
 * comando destrutivo acertar o banco errado sem avisar.
 *
 * Aqui a escolha é por argumento, visível na linha que foi digitada:
 *
 *   npx tsx scripts/limpar-dados.ts              → dev, do .env.local
 *   npx tsx scripts/limpar-dados.ts --producao   → produção, do .env.production.local
 *
 * Nenhum arquivo é editado, o padrão é o ambiente descartável, e atingir
 * produção exige dizer isso em voz alta.
 */
import { config } from "dotenv";

export type Ambiente = {
  nome: "desenvolvimento" | "produção";
  url: string;
  host: string;
};

export function resolverAmbiente(): Ambiente {
  const producao = process.argv.includes("--producao");
  const arquivo = producao ? ".env.production.local" : ".env.local";

  // `override` porque o dotenv, por padrão, não substitui o que já está no
  // ambiente: sem isso o .env.local carregado antes venceria e o --producao
  // seria silenciosamente ignorado, que é o pior desfecho possível aqui.
  config({ path: arquivo, override: true, quiet: true });

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      `\nDATABASE_URL não encontrada em ${arquivo}.\n` +
        (producao
          ? "Crie o arquivo com a string de produção:\n" +
            '  echo \'DATABASE_URL="postgresql://..."\' > .env.production.local\n' +
            "Ou puxe da Vercel:\n" +
            "  npx vercel env pull .env.production.local --environment production\n"
          : "Copie .env.example para .env.local e preencha.\n"),
    );
    process.exit(1);
  }

  return {
    nome: producao ? "produção" : "desenvolvimento",
    url,
    host: url.match(/@([^/]+)/)?.[1] ?? "desconhecido",
  };
}

/** Cabeçalho que todo script administrativo imprime antes de agir. */
export function anunciar(ambiente: Ambiente) {
  const marca = ambiente.nome === "produção" ? "!!" : "  ";
  console.log(`\n${marca} Ambiente: ${ambiente.nome}`);
  console.log(`${marca} Banco:    ${ambiente.host}\n`);
}
