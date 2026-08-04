"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Casca dos formulários de entrada.
 *
 * A validação de formato roda aqui e é definitiva. A verificação de credencial
 * — senha correta, conta existente, cadastro aprovado — depende do servidor e
 * ainda não existe: `aoEnviar` devolve os erros de formato e a navegação segue
 * como se tivesse dado certo.
 *
 * Quando o backend entrar, o corpo vira uma Server Action e o resto permanece,
 * incluindo o estado de carregamento e a área de erro geral.
 */

type Erros = Record<string, string>;

export function AuthForm({
  titulo,
  descricao,
  children,
  aoEnviar,
  rotuloEnvio,
  destino,
  rodape,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: (props: { erros: Erros; enviando: boolean }) => ReactNode;
  aoEnviar: (dados: FormData) => Erros | null;
  rotuloEnvio: string;
  /** Para onde ir quando a validação passa. */
  destino: string;
  rodape?: ReactNode;
}) {
  const router = useRouter();
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {descricao ? (
        <p className="text-muted-foreground mt-2 text-sm">{descricao}</p>
      ) : null}

      <form
        noValidate
        className="mt-8 space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          const resultado = aoEnviar(new FormData(evento.currentTarget));
          if (resultado) {
            setErros(resultado);
            return;
          }
          setErros({});
          setEnviando(true);
          router.push(destino);
        }}
      >
        {children({ erros, enviando })}

        {erros.geral ? (
          <p
            role="alert"
            className="border-negative/30 bg-negative/5 text-negative rounded-md border px-3 py-2 text-sm"
          >
            {erros.geral}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Entrando…
            </>
          ) : (
            rotuloEnvio
          )}
        </Button>
      </form>

      {rodape ? (
        <div className="text-muted-foreground mt-6 text-center text-sm">{rodape}</div>
      ) : null}

      {/* Aviso honesto enquanto não há verificação de credencial. Sai junto com
          a entrada do backend. */}
      <p className="border-border text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
        Demonstração — a autenticação entra na fase de backend. Qualquer dado
        válido avança.
      </p>
    </section>
  );
}
