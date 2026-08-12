"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, Loader2 } from "lucide-react";

import { enviarFeedback } from "@/actions/feedback";
import { CampoArea, CampoSelecao } from "@/components/forms/fields";
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
import { versaoAtual } from "@/lib/changelog";

/**
 * Envio de relato, aberto de qualquer tela.
 *
 * Fica no menu, e não numa rota própria, por causa de um detalhe que decide a
 * utilidade da coisa: **a tela de origem só pode ser capturada de onde a pessoa
 * está**. Uma página `/suporte` registraria sempre `/suporte` como rota, e
 * perguntar "em qual tela aconteceu?" traria resposta imprecisa ou vazia.
 *
 * `rota` e `versao` vão junto sem que ninguém precise digitar. São o que separa
 * este formulário de um pedido de e-mail: metade dos relatos se resolve sabendo
 * apenas onde a pessoa estava e o que estava publicado naquele momento.
 */
export function Suporte() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estado) => {
        setAberto(estado);
        if (!estado) {
          setErros({});
          setAviso(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <LifeBuoy className="size-4 shrink-0" aria-hidden="true" />
          Suporte
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Suporte e sugestões</DialogTitle>
          <DialogDescription>
            Encontrou um erro, ficou com dúvida ou tem uma ideia? A resposta vai
            para o e-mail do seu cadastro.
          </DialogDescription>
        </DialogHeader>

        {aviso ? (
          <p
            role="status"
            className="border-border bg-secondary/50 text-muted-foreground rounded-md border px-4 py-3 text-sm"
          >
            {aviso}
          </p>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={async (evento) => {
              evento.preventDefault();
              const dados = new FormData(evento.currentTarget);
              setEnviando(true);
              try {
                const resultado = await enviarFeedback({
                  tipo: String(dados.get("tipo") ?? "bug"),
                  mensagem: String(dados.get("mensagem") ?? ""),
                  // Contexto que ninguém digita: a tela atual e o que está no ar.
                  rota: pathname,
                  versao: versaoAtual,
                });
                if (!resultado.ok) {
                  setErros(resultado.erros);
                  return;
                }
                setErros({});
                setAviso(resultado.aviso);
              } finally {
                setEnviando(false);
              }
            }}
          >
            <CampoSelecao
              label="Tipo"
              name="tipo"
              defaultValue="bug"
              erro={erros.tipo}
              opcoes={[
                { valor: "bug", rotulo: "Algo está errado" },
                { valor: "duvida", rotulo: "Tenho uma dúvida" },
                { valor: "sugestao", rotulo: "Tenho uma sugestão" },
              ]}
            />

            <CampoArea
              label="O que aconteceu?"
              name="mensagem"
              obrigatorio
              erro={erros.mensagem}
              ajuda="Se for um erro, conte o que você fez antes dele aparecer."
              placeholder="Ao salvar um lançamento de retirada, o valor apareceu somando em vez de descontar."
            />

            <p className="text-muted-foreground text-xs">
              Vão junto, sem você digitar: a tela em que você está ({pathname}) e
              a versão {versaoAtual}.
            </p>

            {erros.geral ? (
              <p
                role="alert"
                className="border-negative/40 bg-negative/10 text-negative rounded-md border px-4 py-3 text-sm"
              >
                {erros.geral}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={enviando}
                onClick={() => setAberto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Enviando…
                  </>
                ) : (
                  "Enviar"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {aviso ? (
          <DialogFooter>
            <Button onClick={() => setAberto(false)}>Fechar</Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
