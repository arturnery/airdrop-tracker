"use client";

import { useState } from "react";
import { Loader2, Pencil, Sparkles } from "lucide-react";

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
 * Criar ou editar um aviso do mural de Airdrops. Campos não controlados
 * (lidos do formulário ao enviar): o diálogo desmonta ao fechar e volta
 * vazio, sem o risco de reabrir com o aviso anterior.
 *
 * A ordem dos campos é a ordem em que aparecem no card e no post do X:
 * projeto, título, tópicos, alerta; depois o detalhe (resumo, passos, prazo)
 * e por fim o que só o X usa.
 */
export function NovoAviso({
  inicial,
  avisos,
  abertoAoMontar = false,
  aoFechar,
  editarId,
}: {
  /** Preenchido pela IA a partir do anúncio colado, ou o aviso que está sendo editado. */
  inicial?: Partial<ValoresAviso>;
  avisos?: string[];
  abertoAoMontar?: boolean;
  aoFechar?: () => void;
  /** Com id, o formulário edita o aviso em vez de publicar um novo. */
  editarId?: string;
}) {
  const { acoes } = useDados();
  const editando = Boolean(editarId);
  return (
    <Formulario
      titulo={editando ? "Editar aviso" : inicial ? "Confira o aviso" : "Novo aviso"}
      descricao={
        editando
          ? "As mudanças aparecem para todos assim que você salvar."
          : inicial
            ? "Preenchido pela IA a partir do anúncio. Nada foi publicado ainda: confira, principalmente o link, o prazo e os números."
            : "Aparece para toda a comunidade no mural de Airdrops."
      }
      gatilho={
        abertoAoMontar ? undefined : editando ? (
          <button
            type="button"
            aria-label="Editar aviso"
            title="Editar aviso"
            className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <BotaoNovo>Novo aviso</BotaoNovo>
        )
      }
      abertoAoMontar={abertoAoMontar}
      aoFechar={aoFechar}
      rotuloEnvio={editando ? "Salvar" : "Publicar aviso"}
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
          destaques: texto(dados, "destaques"),
          ticker: texto(dados, "ticker"),
          alerta: texto(dados, "alerta"),
          postOficialX: texto(dados, "postOficialX"),
        };
        const resultado = avisoSchema.safeParse(bruto);
        if (!resultado.success) return erros(resultado);
        return editarId ? acoes.atualizarAviso(editarId, bruto) : acoes.publicarAviso(bruto);
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
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto label="Projeto" name="projeto" defaultValue={inicial?.projeto} erro={e.projeto} placeholder="Extended" />
            <CampoTexto label="Ticker" name="ticker" defaultValue={inicial?.ticker} erro={e.ticker} placeholder="XTEN" />
            <CampoTexto label="@ do projeto no X" name="perfilX" defaultValue={inicial?.perfilX} erro={e.perfilX} placeholder="extendedapp" />
          </div>
          <CampoTexto label="Título" name="titulo" obrigatorio defaultValue={inicial?.titulo} erro={e.titulo} />
          <CampoArea
            label="Tópicos principais"
            name="destaques"
            defaultValue={inicial?.destaques}
            erro={e.destaques}
            rows={4}
            ajuda="Um por linha: o que será distribuído e a data. Aparecem no card e viram as setas do post."
          />
          <CampoTexto
            label="Alerta"
            name="alerta"
            defaultValue={inicial?.alerta}
            erro={e.alerta}
            placeholder="Não terá página para claim: será dropado direto na wallet, então fiquem atentos a golpes"
          />
          <CampoArea label="Resumo" name="resumo" obrigatorio defaultValue={inicial?.resumo} erro={e.resumo} rows={3} />
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
          <fieldset className="border-border space-y-4 rounded-md border p-3">
            <legend className="text-muted-foreground px-1 text-xs font-medium">Só no post do X</legend>
            <CampoTexto
              label="Post oficial no X"
              name="postOficialX"
              defaultValue={inicial?.postOficialX}
              erro={e.postOficialX}
              placeholder="https://x.com/extendedapp/status/..."
              ajuda="O post da comunidade sai citando este, o que mostra que a notícia veio da fonte."
            />
            <CampoTexto
              label="Título do post (opcional)"
              name="chamadaX"
              defaultValue={inicial?.chamadaX}
              erro={e.chamadaX}
              placeholder="Anúncio do airdrop da @projeto"
              ajuda="Em branco, o post usa 'Anúncio do airdrop da @projeto'. O 🪂 é colocado no fim."
            />
          </fieldset>
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
