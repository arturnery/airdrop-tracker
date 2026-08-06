"use client";

import { useState, type ReactNode } from "react";
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
  /**
   * Devolve os erros quando falha. Em caso de sucesso não devolve nada: a
   * própria ação redireciona no servidor.
   */
  aoEnviar: (
    dados: FormData,
  ) => Promise<{ erros?: Erros; aviso?: string } | void>;
  rotuloEnvio: string;
  /** Texto durante o envio. Verificar senha leva ~1s por causa do hash. */
  rotuloCarregando?: string;
  rodape?: ReactNode;
}) {
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState<string | null>(null);
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

          /*
           * Só chega aqui com valor quando deu erro: no sucesso a ação
           * redireciona no servidor e esta linha não executa. O estado de
           * carregamento fica até a navegação concluir.
           */
          if (resultado) {
            setErros(resultado.erros ?? {});
            setAviso(resultado.aviso ?? null);
            setEnviando(false);
          }
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

        {/* Confirmação em tom neutro: não é erro, e pintá-la de vermelho
            faria a pessoa achar que algo deu errado. */}
        {aviso ? (
          <p
            role="status"
            className="border-primary/30 bg-primary/5 text-muted-foreground rounded-md border px-3 py-2 text-sm"
          >
            {aviso}
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
