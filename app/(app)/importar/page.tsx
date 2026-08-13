import { ArrowRight, FileSpreadsheet } from "lucide-react";

import { PageHeader } from "@/components/page-header";

const mapeamento = [
  { de: "Depósito na Plataforma", para: "Transação · Depósito", destaque: false },
  { de: "Perda em Trade", para: "Transação · Resultado de trade", destaque: false },
  { de: "Saldo Atualizado", para: "Snapshot de saldo", destaque: true },
  { de: "não reconhecida", para: "Fila de revisão", destaque: false },
];

/**
 * Tela de importação.
 *
 * **Só a explicação do mapeamento está pronta.** Não há parser, prévia nem
 * gravação: o desenho está em ARCHITECTURE.md §7 e a implementação, no roadmap.
 *
 * A tela existe mesmo assim porque a decisão que ela documenta é a central do
 * projeto: "Saldo Atualizado" não vira transação. Enquanto isso, o aviso diz o
 * que a pessoa pode esperar, em vez de prometer um botão que não existe.
 */
export default function ImportarPage() {
  return (
    <>
      <PageHeader
        title="Importar planilha"
        description="Traz o histórico do Google Sheets sem redigitar nada."
      />

      <div className="border-border rounded-lg border border-dashed px-6 py-12 text-center">
        <FileSpreadsheet
          className="text-muted-foreground mx-auto size-8"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium">Ainda não é possível importar</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
          O fluxo será em duas etapas: primeiro uma prévia do que vai ser criado, do que
          será ignorado como duplicata e do que não foi reconhecido; só depois a
          gravação, com possibilidade de desfazer o lote inteiro.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="mb-1 text-sm font-medium">Como cada linha será interpretada</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          A coluna <em>Ação Realizada</em> decide o destino da linha.
        </p>

        <ul className="border-border divide-border divide-y rounded-lg border">
          {mapeamento.map((item) => (
            <li
              key={item.de}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="text-muted-foreground font-mono text-xs">{item.de}</span>
              <ArrowRight
                className="text-muted-foreground size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span className={item.destaque ? "text-caution font-medium" : ""}>
                {item.para}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Repare na terceira linha:{" "}
          <strong className="text-foreground font-medium">
            &quot;Saldo Atualizado&quot; não vira transação
          </strong>
          . É foto do saldo, não movimentação de dinheiro: somar as duas coisas na mesma
          coluna é o que fazia o total da planilha sair errado. A separação acontece no
          momento da importação.
        </p>
      </section>
    </>
  );
}
