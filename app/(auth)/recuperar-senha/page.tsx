"use client";

import Link from "next/link";

import { AuthForm } from "@/components/forms/auth-form";
import { CampoTexto } from "@/components/forms/fields";
import { erros as extrairErros, recuperarSenhaSchema } from "@/lib/validators";

export default function RecuperarSenhaPage() {
  return (
    <AuthForm
      titulo="Recuperar senha"
      descricao="Você recebe um link para definir uma senha nova."
      rotuloCarregando="Enviando…"
      rotuloEnvio="Enviar link"
      aoEnviar={async (dados) => {
        const resultado = recuperarSenhaSchema.safeParse({
          email: String(dados.get("email") ?? ""),
        });
        if (!resultado.success) {
          return { ok: false as const, erros: extrairErros(resultado) };
        }
        // O envio do e-mail entra quando houver serviço configurado. A tela
        // responde igual de qualquer forma, para não revelar quem tem conta.
        return { ok: true as const, destino: "/entrar" };
      }}
      rodape={
        <Link href="/entrar" className="text-foreground underline underline-offset-4">
          Voltar para entrar
        </Link>
      }
    >
      {({ erros }) => (
        <CampoTexto
          label="E-mail"
          name="email"
          type="email"
          obrigatorio
          autoComplete="email"
          erro={erros.email}
          /* Não confirma se o e-mail existe: dizer "não encontrado" revelaria
             quem tem conta para quem estivesse testando endereços. */
          ajuda="Se houver conta com esse e-mail, o link chega em instantes."
          placeholder="voce@exemplo.com"
          autoFocus
        />
      )}
    </AuthForm>
  );
}
