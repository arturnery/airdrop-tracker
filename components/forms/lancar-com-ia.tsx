"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { interpretarLancamento } from "@/actions/ia";
import { NovoLancamento } from "@/components/forms/dialogs";
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
import type { SugestaoLancamento } from "@/lib/interpretar-lancamento";

/**
 * Lançamento escrito em frase, conferido no formulário de sempre.
 *
 * Dois diálogos em sequência, não um só com dois passos: o segundo é o
 * próprio `NovoLancamento`, então salvar daqui e salvar à mão passam pela
 * mesma tela, validação e Server Action. Um formulário paralelo "da IA"
 * envelheceria separado do original na primeira mudança de campo.
 */
export function LancarComIA() {
  const [pedindo, setPedindo] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  /*
   * `versao` remonta o formulário a cada sugestão nova: ele nasce aberto e os
   * campos leem o valor inicial só ao montar, então reaproveitar a instância
   * não reabriria nada e mostraria a sugestão anterior.
   */
  const [sugestao, setSugestao] = useState<{
    dados: SugestaoLancamento;
    versao: number;
  } | null>(null);

  async function interpretar() {
    setErro(null);
    setCarregando(true);
    try {
      const resultado = await interpretarLancamento(texto);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setSugestao((anterior) => ({
        dados: resultado.sugestao,
        versao: (anterior?.versao ?? 0) + 1,
      }));
      setPedindo(false);
      setTexto("");
    } catch {
      setErro("Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Dialog
        open={pedindo}
        onOpenChange={(estado) => {
          setPedindo(estado);
          if (!estado) setErro(null);
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Sparkles className="size-4" aria-hidden="true" />
            Lançar com IA
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lançar com IA</DialogTitle>
            <DialogDescription>
              Escreva como contaria para alguém. O formulário abre preenchido
              para você conferir, e nada é salvo antes disso.
            </DialogDescription>
          </DialogHeader>

          <form
            noValidate
            className="space-y-4"
            onSubmit={(evento) => {
              evento.preventDefault();
              if (!carregando) void interpretar();
            }}
          >
            <CampoArea
              label="O que aconteceu"
              name="texto"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              onKeyDown={(evento) => {
                // Enter envia, como num chat; Shift+Enter quebra a linha.
                if (evento.key === "Enter" && !evento.shiftKey) {
                  evento.preventDefault();
                  evento.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Depositei $100 na Lighter, conta X, para estratégia DN"
              maxLength={500}
              autoFocus
              erro={erro ?? undefined}
              ajuda="A frase e os nomes dos seus projetos e contas vão para um provedor externo de IA. Endereços de carteira e e-mails não."
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={carregando}
                onClick={() => setPedindo(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={carregando || texto.trim().length < 3}>
                {carregando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Interpretando…
                  </>
                ) : (
                  "Interpretar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {sugestao ? (
        <NovoLancamento
          key={sugestao.versao}
          sugestao={sugestao.dados}
        />
      ) : null}
    </>
  );
}
