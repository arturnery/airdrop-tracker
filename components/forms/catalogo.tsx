"use client";

import { useState } from "react";
import { Loader2, Megaphone } from "lucide-react";

import { useDados } from "@/components/data-provider";
import { CampoArea } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { destaqueSchema, erros } from "@/lib/validators";

/**
 * Publica ou atualiza o destaque de um projeto no catálogo da comunidade
 * (ARCHITECTURE §13).
 *
 * Só renderiza para quem administra, mas isso é conveniência de tela, não a
 * proteção: quem impede de verdade é `exigirAdministrador`, chamado dentro da
 * Server Action. Esconder o botão não impediria a requisição direta (§9.4).
 *
 * O nome do botão muda conforme já existe entrada ou não, e é a mesma ação
 * dos dois lados: publicar de novo recopia os campos por cima da entrada que
 * já existe, em vez de criar uma segunda.
 */
export function DestacarProjeto({
  projectId,
  nomeDoProjeto,
}: {
  projectId: string;
  nomeDoProjeto: string;
}) {
  const { dataset, souAdmin, salvando, acoes } = useDados();
  const [aberto, setAberto] = useState(false);
  const [problemas, setProblemas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [aguardandoTela, setAguardandoTela] = useState(false);

  if (!souAdmin) return null;

  const entrada = dataset.catalogProjects.find(
    (c) => c.sourceProjectId === projectId,
  );
  const publicado = entrada?.publishedAt != null;

  if (aguardandoTela && !salvando) {
    setAguardandoTela(false);
    setAberto(false);
  }
  const ocupado = enviando || aguardandoTela;

  return (
    <div className="border-border rounded-lg border border-dashed p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Megaphone className="text-brand size-4" aria-hidden="true" />
        Catálogo da comunidade
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {publicado
          ? "Este projeto aparece para quem ainda não farma, com um botão de adicionar ao próprio portfólio."
          : "Destaque este projeto para a comunidade: nome, categoria, rede, links e um resumo curto, sem nenhum dado financeiro seu."}
      </p>

      <Dialog
        open={aberto}
        onOpenChange={(estado) => {
          setAberto(estado);
          if (!estado) setProblemas({});
        }}
      >
        <div className="mt-3 flex items-center gap-2">
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant={publicado ? "outline" : "default"}>
              {publicado ? "Atualizar destaque" : "Destacar para a comunidade"}
            </Button>
          </DialogTrigger>
          {publicado ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={salvando}
              onClick={() => void acoes.removerDestaque(projectId)}
            >
              Remover do catálogo
            </Button>
          ) : null}
        </div>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {publicado ? "Atualizar destaque" : "Destacar para a comunidade"}
            </DialogTitle>
            <DialogDescription>
              {nomeDoProjeto} vai aparecer com nome, categoria, rede e links. Nenhum
              aporte, saldo ou anotação sua sai daqui.
            </DialogDescription>
          </DialogHeader>

          <form
            noValidate
            onSubmit={async (evento) => {
              evento.preventDefault();
              const dados = new FormData(evento.currentTarget);
              const bruto = { summary: String(dados.get("summary") ?? "") };
              const resultado = destaqueSchema.safeParse(bruto);
              if (!resultado.success) {
                setProblemas(erros(resultado));
                return;
              }

              setEnviando(true);
              try {
                const erro = await acoes.destacarProjeto(projectId, bruto);
                if (erro) {
                  setProblemas(erro);
                  return;
                }
                setProblemas({});
                setAguardandoTela(true);
              } finally {
                setEnviando(false);
              }
            }}
            className="space-y-4"
          >
            <CampoArea
              label="Resumo para a comunidade"
              name="summary"
              defaultValue={entrada?.summary ?? ""}
              erro={problemas.summary}
              placeholder="Perp DEX com programa de pontos ativo. Fácil de começar: só precisa de uma carteira na Arbitrum e alguns trades por semana."
              ajuda="Opcional, mas é o que faz alguém clicar: só o nome não conta a história."
            />

            {problemas.geral ? (
              <p
                role="alert"
                className="border-negative/30 bg-negative/5 text-negative rounded-md border px-3 py-2 text-sm"
              >
                {problemas.geral}
              </p>
            ) : null}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={ocupado}
                onClick={() => setAberto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={ocupado}>
                {ocupado ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Salvando…
                  </>
                ) : publicado ? (
                  "Atualizar"
                ) : (
                  "Publicar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
