import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Placeholder da Fase 0. O dashboard real entra na Fase 1, quando as tabelas
 * de projeto, conta e transação existirem. Ver ARCHITECTURE.md §10.
 */

const fases = [
  { n: 0, nome: "Setup e infraestrutura", estado: "feito" },
  {
    n: 1,
    nome: "Fundação: contas, projetos, transações e dashboard",
    estado: "próxima",
  },
  { n: 2, nome: "Importação da planilha", estado: "pendente" },
  { n: 3, nome: "Aba do projeto", estado: "pendente" },
  { n: 4, nome: "Tarefas e recorrência", estado: "pendente" },
  { n: 5, nome: "Metas, airdrop recebido e P&L", estado: "pendente" },
  { n: 6, nome: "Autenticação para a comunidade", estado: "pendente" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          airdrop-tracker
        </h1>
        <p className="text-muted-foreground mt-2">
          Controle de farming de airdrops: capital alocado, tarefas do dia e
          resultado por projeto e por conta.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Progresso da implementação</CardTitle>
          <CardDescription>
            Arquitetura definida em ARCHITECTURE.md.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="divide-border divide-y">
            {fases.map((fase) => (
              <li
                key={fase.n}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="flex items-baseline gap-3">
                  <span className="text-muted-foreground font-mono text-xs">
                    {String(fase.n).padStart(2, "0")}
                  </span>
                  <span className="text-sm">{fase.nome}</span>
                </span>
                <Badge
                  variant={
                    fase.estado === "feito"
                      ? "default"
                      : fase.estado === "próxima"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {fase.estado}
                </Badge>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
