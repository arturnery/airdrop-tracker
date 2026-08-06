"use client";

import Link from "next/link";

import { AuthForm } from "@/components/forms/auth-form";
import { CampoTexto } from "@/components/forms/fields";
import { erros as extrairErros, recuperarSenhaSchema } from "@/lib/validators";

export default function RecuperarSenhaPage() {
  return (
    <AuthForm
      titulo="Recuperar senha"
      descricao="O envio automático por e-mail ainda não está ativo."
      rotuloCarregando="Enviando…"
      rotuloEnvio="Registrar pedido"
      destaque={
        <>
          <strong className="font-medium">Peça a redefinição no grupo.</strong>{" "}
          Quem administra gera uma senha temporária e entrega direto para você.
          É mais rápido que esperar e-mail, e sem risco de cair no spam.
        </>
      }
      aoEnviar={async (dados) => {
        const resultado = recuperarSenhaSchema.safeParse({
          email: String(dados.get("email") ?? ""),
        });
        if (!resultado.success) return { erros: extrairErros(resultado) };
        /*
         * Sem serviço de e-mail configurado, esta tela não envia nada. Em vez de
         * prometer um link que não chega, ela orienta o caminho que funciona
         * hoje: o administrador redefine pela área de membros.
         *
         * A resposta continua sem confirmar se o endereço existe.
         */
        return {
          aviso:
            "Anotado. Fale com quem administra a comunidade para receber uma senha temporária.",
        };
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
          ajuda="Serve para você conferir qual endereço usou no cadastro."
          placeholder="voce@exemplo.com"
          autoFocus
        />
      )}
    </AuthForm>
  );
}
