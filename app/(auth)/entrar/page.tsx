"use client";

import Link from "next/link";

import { entrar } from "@/actions/auth";
import { AuthForm } from "@/components/forms/auth-form";
import { CampoTexto } from "@/components/forms/fields";

export default function EntrarPage() {
  return (
    <AuthForm
      titulo="Entrar"
      descricao="Acompanhe seu farming de airdrops."
      rotuloCarregando="Entrando…"
      rotuloEnvio="Entrar"
      aoEnviar={(dados) =>
        entrar({
          email: String(dados.get("email") ?? ""),
          password: String(dados.get("password") ?? ""),
        })
      }
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link
            href="/criar-conta"
            className="text-foreground underline underline-offset-4"
          >
            Criar conta
          </Link>
        </>
      }
    >
      {({ erros }) => (
        <>
          <CampoTexto
            label="E-mail"
            name="email"
            type="email"
            obrigatorio
            autoComplete="email"
            erro={erros.email}
            placeholder="voce@exemplo.com"
            autoFocus
          />
          <div>
            <CampoTexto
              label="Senha"
              name="password"
              type="password"
              obrigatorio
              autoComplete="current-password"
              erro={erros.password}
            />
            <div className="mt-1.5 text-right">
              <Link
                href="/recuperar-senha"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-xs underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
              >
                Esqueci minha senha
              </Link>
            </div>
          </div>
        </>
      )}
    </AuthForm>
  );
}
