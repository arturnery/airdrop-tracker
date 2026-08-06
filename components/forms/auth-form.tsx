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
  rotuloCarregando = "Aguarde…",
  rodape,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: (props: { erros: Erros; enviando: boolean }) => ReactNode;
  /** Devolve os erros, ou o destino quando dá certo. */
  aoEnviar: (dados: FormData) => Promise<
    { ok: true; destino: string } | { ok: false; erros: Erros }
  >;
  rotuloEnvio: string;
  /** Texto durante o envio. Verificar senha leva ~1s por causa do hash. */
  rotuloCarregando?: string;
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
        onSubmit={async (evento) => {
          evento.preventDefault();
          setEnviando(true);

          const resultado = await aoEnviar(new FormData(evento.currentTarget));

          if (!resultado.ok) {
            setErros(resultado.erros);
            setEnviando(false);
            return;
          }

          /*
           * Em caso de sucesso o botão NÃO volta ao estado normal: a navegação
           * leva um instante, e devolver o botão antes dela dá a impressão de
           * que o clique não fez nada — foi exatamente o que aconteceu no
           * primeiro teste.
           */
          setErros({});
          router.push(resultado.destino);
          // Recarrega para que o layout enxergue a sessão nova.
          router.refresh();
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

        <Button
          type="submit"
          className="w-full"
          disabled={enviando}
          aria-busy={enviando}
        >
          {enviando ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {rotuloCarregando}
            </>
          ) : (
            rotuloEnvio
          )}
        </Button>
      </form>

      {rodape ? (
        <div className="text-muted-foreground mt-6 text-center text-sm">{rodape}</div>
      ) : null}

    </section>
  );
}
