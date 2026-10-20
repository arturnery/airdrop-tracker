"use client";

import { useState } from "react";
import { ImageUp, Loader2, Sparkles } from "lucide-react";

import { interpretarPrint } from "@/actions/trade";
import { NovoSinal } from "@/components/forms/sinal";
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
import type { SugestaoSinal } from "@/lib/interpretar-sinal";
import { cn } from "@/lib/utils";

/*
 * O print é reduzido no navegador antes de sair: até 1600 px no lado maior,
 * em JPEG. Texto de gráfico continua legível nesse tamanho, e o envio fica
 * abaixo do limite de 1 MB das Server Actions, que preferimos não aumentar
 * para o site inteiro. Se ainda passar do teto, tenta menor e mais comprimido.
 */
const TETO = 900_000;
const TENTATIVAS: [number, number][] = [
  [1600, 0.85],
  [1280, 0.75],
  [1024, 0.7],
];

async function reduzir(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = await new Promise<HTMLImageElement>((resolver, rejeitar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rejeitar(new Error("imagem ilegível"));
      img.src = url;
    });
    let ultima = "";
    for (const [lado, qualidade] of TENTATIVAS) {
      const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(imagem.width * escala);
      canvas.height = Math.round(imagem.height * escala);
      const ctx = canvas.getContext("2d")!;
      // Fundo branco: PNG transparente viraria preto no JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      ultima = canvas.toDataURL("image/jpeg", qualidade);
      if (ultima.length <= TETO) return ultima;
    }
    return ultima;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sinal a partir do print do professor: a imagem vai para a IA, que devolve
 * os campos; o formulário "Confira o sinal" abre preenchido e nada é
 * publicado sem conferência. A imagem não é guardada em lugar nenhum.
 */
export function SinalPorPrint() {
  const [aberto, setAberto] = useState(false);
  const [imagem, setImagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [sugestao, setSugestao] = useState<{ dados: SugestaoSinal; versao: number } | null>(null);

  async function receber(arquivo: File | null | undefined) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setErro("Isso não é uma imagem. Envie o print da operação.");
      return;
    }
    setErro(null);
    try {
      setImagem(await reduzir(arquivo));
    } catch {
      setErro("Não consegui abrir essa imagem. Tente outro arquivo.");
    }
  }

  async function ler() {
    if (!imagem) return;
    setErro(null);
    setLendo(true);
    try {
      const r = await interpretarPrint(imagem);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setSugestao((anterior) => ({ dados: r.sugestao, versao: (anterior?.versao ?? 0) + 1 }));
      setAberto(false);
      setImagem(null);
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
          if (!estado) {
            setErro(null);
            setImagem(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Sparkles className="size-4" aria-hidden="true" />
            Ler print com IA
          </Button>
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-lg"
          // Colar com Ctrl+V em qualquer ponto do diálogo: é o caminho mais
          // curto para um print recém-tirado.
          onPaste={(evento) => {
            const item = [...evento.clipboardData.items].find((i) => i.type.startsWith("image/"));
            if (item) {
              evento.preventDefault();
              void receber(item.getAsFile());
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Ler print com IA</DialogTitle>
            <DialogDescription>
              Cole (Ctrl+V), arraste ou escolha o print da operação. A IA preenche o sinal e você
              confere antes de publicar. A imagem não é guardada.
            </DialogDescription>
          </DialogHeader>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              void receber(e.dataTransfer.files[0]);
            }}
            className={cn(
              "border-border hover:border-brand/50 focus-within:ring-ring flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm transition-colors focus-within:ring-2",
              arrastando && "border-brand bg-brand/5",
            )}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => void receber(e.target.files?.[0])}
            />
            {imagem ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local, sem otimização a fazer
              <img src={imagem} alt="Prévia do print" className="max-h-64 rounded-md object-contain" />
            ) : (
              <>
                <ImageUp className="text-muted-foreground size-6" aria-hidden="true" />
                <span className="text-muted-foreground">Cole, arraste ou clique para escolher</span>
              </>
            )}
          </label>

          {erro ? (
            <p role="alert" className="border-negative/30 bg-negative/5 text-negative rounded-md border px-3 py-2 text-sm">
              {erro}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={lendo} onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!imagem || lendo} onClick={() => void ler()}>
              {lendo ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Lendo o print, pode levar até meio minuto…
                </>
              ) : (
                "Ler print"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sugestao ? (
        <NovoSinal
          key={sugestao.versao}
          inicial={sugestao.dados.valores}
          avisos={sugestao.dados.avisos}
          abertoAoMontar
        />
      ) : null}
    </>
  );
}
