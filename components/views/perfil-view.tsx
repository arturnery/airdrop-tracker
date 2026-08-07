"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { atualizarPerfil, trocarSenha } from "@/actions/perfil";
import { CampoTexto } from "@/components/forms/fields";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { Sessao } from "@/lib/auth";

/**
 * Perfil da própria conta.
 *
 * Nome e senha ficam em formulários separados de propósito: trocar o nome não
 * deveria exigir digitar a senha, e trocar a senha não deveria salvar o nome
 * junto sem querer. Cada um confirma o que fez em separado.
 */

type Erros = Record<string, string>;

function Secao({
  titulo,
  descricao,
  rotuloEnvio,
  aoEnviar,
  desabilitado = false,
  children,
}: {
  titulo: string;
  descricao: string;
  rotuloEnvio: string;
  desabilitado?: boolean;
  aoEnviar: (
    dados: FormData,
  ) => Promise<{ ok: true; aviso?: string } | { ok: false; erros: Erros }>;
  children: (props: { erros: Erros }) => ReactNode;
}) {
  const [erros, setErros] = useState<Erros>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <section className="border-border rounded-lg border p-6">
      <h2 className="text-base font-medium">{titulo}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{descricao}</p>

      <fieldset disabled={desabilitado} className="contents">
      <form
        noValidate
        className="mt-6 space-y-4"
        onSubmit={async (evento) => {
          evento.preventDefault();
          const formulario = evento.currentTarget;
          setEnviando(true);
          setAviso(null);

          try {
            const resultado = await aoEnviar(new FormData(formulario));
            if (!resultado.ok) {
              setErros(resultado.erros);
              return;
            }
            setErros({});
            setAviso(resultado.aviso ?? "Salvo.");
            // Campos de senha não devem ficar preenchidos depois de salvar.
            formulario
              .querySelectorAll<HTMLInputElement>('input[type="password"]')
              .forEach((campo) => {
                campo.value = "";
              });
          } finally {
            setEnviando(false);
          }
        }}
      >
        {children({ erros })}

        {erros.geral ? (
          <p
            role="alert"
            className="border-negative/40 bg-negative/10 text-negative rounded-md border px-4 py-3 text-sm"
          >
            {erros.geral}
          </p>
        ) : null}

        {aviso ? (
          <p
            role="status"
            className="border-border bg-secondary/50 text-muted-foreground rounded-md border px-4 py-3 text-sm"
          >
            {aviso}
          </p>
        ) : null}

        <Button type="submit" disabled={enviando || desabilitado}>
          {enviando ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Salvando…
            </>
          ) : (
            rotuloEnvio
          )}
        </Button>
      </form>
      </fieldset>
    </section>
  );
}

export function PerfilView({
  sessao,
  isDemo = false,
}: {
  sessao: Sessao;
  isDemo?: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Perfil"
        description="Seus dados de acesso. Só você enxerga esta página."
      />

      <div className="max-w-xl space-y-6">
        {/* O servidor recusa a alteração de qualquer jeito. O aviso existe para
            a pessoa não preencher o formulário até descobrir isso. */}
        {isDemo ? (
          <p
            role="status"
            className="border-border bg-secondary/50 text-muted-foreground rounded-md border px-4 py-3 text-sm"
          >
            Você está na conta de demonstração. Nome e senha ficam fixos, porque
            valem para todo mundo que entra por aqui. O resto do sistema está
            liberado: crie projetos, lance valores e marque tarefas à vontade.
          </p>
        ) : null}
        <Secao
          desabilitado={isDemo}
          titulo="Seus dados"
          descricao="O nome aparece na barra lateral e, no futuro, para quem visitar seu perfil."
          rotuloEnvio="Salvar nome"
          aoEnviar={(dados) =>
            atualizarPerfil({ name: String(dados.get("name") ?? "") })
          }
        >
          {({ erros }) => (
            <>
              <CampoTexto
                label="Nome"
                name="name"
                obrigatorio
                defaultValue={sessao.nome}
                erro={erros.name}
                autoComplete="name"
              />
              {/* O e-mail identifica a conta e é usado para entrar, então não
                  se edita por aqui. Mostrar desabilitado evita a dúvida de
                  onde mudá-lo. */}
              <CampoTexto
                label="E-mail"
                name="email"
                type="email"
                defaultValue={sessao.email}
                disabled
                ajuda="É com ele que você entra. Para trocar, fale com quem administra."
              />
            </>
          )}
        </Secao>

        <Secao
          desabilitado={isDemo}
          titulo="Trocar senha"
          descricao="Se recebeu uma senha temporária, troque por uma sua."
          rotuloEnvio="Trocar senha"
          aoEnviar={(dados) =>
            trocarSenha({
              atual: String(dados.get("atual") ?? ""),
              nova: String(dados.get("nova") ?? ""),
              confirmacao: String(dados.get("confirmacao") ?? ""),
            })
          }
        >
          {({ erros }) => (
            <>
              <CampoTexto
                label="Senha atual"
                name="atual"
                type="password"
                obrigatorio
                autoComplete="current-password"
                erro={erros.atual}
              />
              <CampoTexto
                label="Nova senha"
                name="nova"
                type="password"
                obrigatorio
                autoComplete="new-password"
                erro={erros.nova}
                ajuda="Pelo menos 8 caracteres."
              />
              <CampoTexto
                label="Repita a nova senha"
                name="confirmacao"
                type="password"
                obrigatorio
                autoComplete="new-password"
                erro={erros.confirmacao}
              />
            </>
          )}
        </Secao>
      </div>
    </>
  );
}
