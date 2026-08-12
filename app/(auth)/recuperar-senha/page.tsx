"use client";

import Link from "next/link";

import { AuthForm } from "@/components/forms/auth-form";
import { CampoTexto } from "@/components/forms/fields";
import { pedirRedefinicaoDeSenha } from "@/actions/auth";
import { erros as extrairErros, recuperarSenhaSchema } from "@/lib/validators";

export default function RecuperarSenhaPage() {
  return (
    <AuthForm
      titulo="Recuperar senha"
      descricao="Quem administra gera uma senha temporária e envia para o seu e-mail."
      rotuloCarregando="Enviando…"
      rotuloEnvio="Registrar pedido"
      destaque={
        <>
          <strong className="font-medium">O envio não é automático.</strong>{" "}
          O pedido entra numa fila e quem administra a comunidade gera a senha
          temporária. No primeiro acesso com ela, o sistema pede que você defina
          a sua.
        </>
      }
      aoEnviar={async (dados) => {
        const email = String(dados.get("email") ?? "");
        const resultado = recuperarSenhaSchema.safeParse({ email });
        if (!resultado.success) return { erros: extrairErros(resultado) };

        /*
         * Envia o valor bruto: o schema tem transform e a Server Action valida
         * de novo. Mandar o já transformado faria a segunda passada receber o
         * que a primeira produziu.
         */
        const pedido = await pedirRedefinicaoDeSenha({ email });
        return pedido.ok ? { aviso: pedido.aviso } : { erros: pedido.erros };
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
