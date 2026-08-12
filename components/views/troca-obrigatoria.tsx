"use client";

import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";

import { trocarSenha } from "@/actions/perfil";
import { CampoTexto } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

/**
 * Tela única de quem entrou com senha temporária.
 *
 * Substitui o aplicativo inteiro: sem barra lateral, sem links, sem saída além
 * de definir a própria senha. É deliberado, porque a senha atual foi vista por
 * quem a gerou e não deveria continuar valendo enquanto a pessoa trabalha.
 *
 * O bloqueio de verdade está no servidor (`actions/_core.ts`): esta tela é o
 * que a pessoa vê, não o que a impede.
 */
export function TrocaObrigatoria({ nome }: { nome: string }) {
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="border-border rounded-lg border p-6">
        <KeyRound className="text-primary size-6" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-medium">Defina uma senha sua</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Olá, {nome}. Você entrou com uma senha temporária, que foi vista por
          quem a gerou. Escolha uma nova para liberar o sistema.
        </p>

        <form
          noValidate
          className="mt-6 space-y-4"
          onSubmit={async (evento) => {
            evento.preventDefault();
            const dados = new FormData(evento.currentTarget);
            setEnviando(true);
            try {
              const resultado = await trocarSenha({
                atual: String(dados.get("atual") ?? ""),
                nova: String(dados.get("nova") ?? ""),
                confirmacao: String(dados.get("confirmacao") ?? ""),
              });
              if (!resultado.ok) {
                setErros(resultado.erros);
                return;
              }
              /*
               * Recarrega a página inteira em vez de navegar: o bloqueio está
               * no layout do servidor, e só uma nova requisição o reavalia.
               */
              window.location.href = "/";
            } finally {
              setEnviando(false);
            }
          }}
        >
          <CampoTexto
            label="Senha temporária"
            name="atual"
            type="password"
            obrigatorio
            autoComplete="current-password"
            erro={erros.atual}
            ajuda="A que você recebeu por e-mail."
            autoFocus
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

          {erros.geral ? (
            <p
              role="alert"
              className="border-negative/40 bg-negative/10 text-negative rounded-md border px-4 py-3 text-sm"
            >
              {erros.geral}
            </p>
          ) : null}

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Salvando…
              </>
            ) : (
              "Definir senha e entrar"
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
