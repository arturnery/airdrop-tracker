"use client";

import Link from "next/link";

import { AuthForm } from "@/components/forms/auth-form";
import { CampoTexto } from "@/components/forms/fields";
import { Checkbox } from "@/components/ui/checkbox";
import { cadastrar } from "@/actions/auth";

export default function CriarContaPage() {
  return (
    <AuthForm
      titulo="Criar conta"
      descricao="O acesso é liberado manualmente depois do cadastro."
      rotuloEnvio="Criar conta"
      aoEnviar={(dados) =>
        cadastrar({
          name: String(dados.get("name") ?? ""),
          email: String(dados.get("email") ?? ""),
          password: String(dados.get("password") ?? ""),
          passwordConfirm: String(dados.get("passwordConfirm") ?? ""),
          accept: String(dados.get("accept") ?? ""),
        })
      }
      rodape={
        <>
          Já tem conta?{" "}
          <Link href="/entrar" className="text-foreground underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      {({ erros }) => (
        <>
          <CampoTexto
            label="Nome"
            name="name"
            obrigatorio
            autoComplete="name"
            erro={erros.name}
            placeholder="Como quer ser chamado"
            autoFocus
          />
          <CampoTexto
            label="E-mail"
            name="email"
            type="email"
            obrigatorio
            autoComplete="email"
            erro={erros.email}
            ajuda="Use o mesmo e-mail da sua assinatura."
            placeholder="voce@exemplo.com"
          />
          <CampoTexto
            label="Senha"
            name="password"
            type="password"
            obrigatorio
            autoComplete="new-password"
            erro={erros.password}
            ajuda="Pelo menos 8 caracteres."
          />
          <CampoTexto
            label="Repita a senha"
            name="passwordConfirm"
            type="password"
            obrigatorio
            autoComplete="new-password"
            erro={erros.passwordConfirm}
          />

          <div className="flex items-start gap-2.5 pt-1">
            <Checkbox id="accept" name="accept" className="mt-0.5" />
            <div>
              <label htmlFor="accept" className="cursor-pointer text-sm">
                Entendo que o acesso depende de aprovação.
              </label>
              {erros.accept ? (
                <p role="alert" className="text-negative mt-1 text-xs">
                  {erros.accept}
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}
    </AuthForm>
  );
}
