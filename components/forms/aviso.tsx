"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { interpretarAnuncio } from "@/actions/avisos";
import { CampoData } from "@/components/forms/campo-data";
import { BotaoNovo, Formulario } from "@/components/forms/dialogs";
import { CampoArea, CampoTexto } from "@/components/forms/fields";
import { useDados } from "@/components/data-provider";
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
import { MAX_ANUNCIO, type SugestaoAviso, type ValoresAviso } from "@/lib/interpretar-aviso";
import { avisoSchema, erros } from "@/lib/validators";

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "");

/**
 * Publicar um aviso no mural de Airdrops. Campos não controlados (lidos do
 * formulário ao enviar): o diálogo desmonta ao fechar e volta vazio, sem o
 * risco de reabrir com o aviso anterior.
 */
export function NovoAviso({
  inicial,
  avisos,
  abertoAoMontar = false,
  aoFechar,
}: {
  /** Preenchido pela IA a partir do anúncio colado. */
  inicial?: ValoresAviso;
  avisos?: string[];
  abertoAoMontar?: boolean;
  aoFechar?: () => void;
}) {
  const { acoes } = useDados();
  return (
    <Formulario
      titulo={inicial ? "Confira o aviso" : "Novo aviso"}
      descricao={
        inicial
          ? "Preenchido pela IA a partir do anúncio. Nada foi publicado ainda: confira, principalmente o link e o prazo."
          : "Aparece para toda a comunidade no mural de Airdrops."
      }
      gatilho={abertoAoMontar ? undefined : <BotaoNovo>Novo aviso</BotaoNovo>}
      abertoAoMontar={abertoAoMontar}
      aoFechar={aoFechar}
      rotuloEnvio="Publicar aviso"
      aoEnviar={(dados) => {
        const bruto = {
          titulo: texto(dados, "titulo"),
          resumo: texto(dados, "resumo"),
          acao: texto(dados, "acao"),
          prazo: texto(dados, "prazo"),
          link: texto(dados, "link"),
          projeto: texto(dados, "projeto"),
          perfilX: texto(dados, "perfilX"),
          chamadaX: texto(dados, "chamadaX"),
        };
        const resultado = avisoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return acoes.publicarAviso(bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          {avisos && avisos.length > 0 ? (
            <ul className="border-caution/40 bg-caution/10 space-y-1 rounded-md border px-3 py-2 text-sm">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <CampoTexto label="Título" name="titulo" obrigatorio defaultValue={inicial?.titulo} erro={e.titulo} />
          <CampoArea label="Resumo" name="resumo" obrigatorio defaultValue={inicial?.resumo} erro={e.resumo} rows={4} />
          <CampoArea
            label="O que fazer"
            name="acao"
            defaultValue={inicial?.acao}
            erro={e.acao}
            rows={3}
            ajuda="Os passos para o membro, um por linha. Em branco se o anúncio não pede ação."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoData label="Prazo" name="prazo" defaultValue={inicial?.prazo || undefined} erro={e.prazo} />
            <CampoTexto label="Link oficial" name="link" defaultValue={inicial?.link} erro={e.link} placeholder="https://" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto label="Projeto" name="projeto" defaultValue={inicial?.projeto} erro={e.projeto} />
            <CampoTexto
              label="@ do projeto no X"
              name="perfilX"
              defaultValue={inicial?.perfilX}
              erro={e.perfilX}
              placeholder="ExtendOfficial"
            />
          </div>
          <CampoTexto
            label="Chamada para o X"
            name="chamadaX"
            defaultValue={inicial?.chamadaX}
            erro={e.chamadaX}
            ajuda="Uma frase, sem link. O post junta o @ do projeto, o link e o convite da comunidade."
          />
        </>
      )}
    </Formulario>
  );
}

/** Cola o anúncio, a IA monta o aviso, e o formulário abre para conferência. */
export function AvisoComIA() {
  const [aberto, setAberto] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [sugestao, setSugestao] = useState<{ dados: SugestaoAviso; versao: number } | null>(null);

  async function ler() {
    setErro(null);
    setLendo(true);
    try {
      const r = await interpretarAnuncio(anuncio);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setSugestao((anterior) => ({ dados: r.sugestao, versao: (anterior?.versao ?? 0) + 1 }));
      setAberto(false);
      setAnuncio("");
    } catch {
      setErro("Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <>
      <Dialog
        open={aberto}
        onOpenChange={(estado) => {
          setAberto(estado);
          if (!estado) setErro(null);
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Sparkles className="size-4" aria-hidden="true" />
            Aviso com IA
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Montar aviso com IA</DialogTitle>
            <DialogDescription>
              Cole o texto do anúncio (o post do projeto, a página do blog, a mensagem do Discord). A IA
              monta o aviso e você confere antes de publicar.
            </DialogDescription>
          </DialogHeader>
          <label className="block">
            <span className="sr-only">Texto do anúncio</span>
            <textarea
              value={anuncio}
              onChange={(e) => setAnuncio(e.target.value)}
              maxLength={MAX_ANUNCIO}
              rows={9}
              placeholder="Cole aqui o anúncio…"
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
            />
          </label>
          <p className="text-muted-foreground -mt-2 text-xs">
            Link do X não funciona: o X bloqueia a leitura automática. Copie o texto do post.
          </p>
          {erro ? (
            <p role="alert" className="border-negative/30 bg-negative/5 text-negative rounded-md border px-3 py-2 text-sm">
              {erro}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={lendo} onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={lendo || anuncio.trim().length < 40} onClick={ler}>
              {lendo ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Lendo o anúncio…
                </>
              ) : (
                "Montar aviso"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sugestao ? (
        <NovoAviso
          key={sugestao.versao}
          inicial={sugestao.dados.valores}
          avisos={sugestao.dados.avisos}
          abertoAoMontar
        />
      ) : null}
    </>
  );
}
