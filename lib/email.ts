import "server-only";

import nodemailer from "nodemailer";

import type { MensagemDeEmail } from "./email-aprovacao";
import { env } from "./env";

/**
 * Envio de e-mail pela conta do Gmail (ARCHITECTURE §27).
 *
 * Gmail com senha de app em vez de um serviço de envio: não exige mexer no
 * DNS do domínio, e o volume (um e-mail por aprovação) fica muito abaixo do
 * limite de 500 por dia.
 *
 * **Nunca lança.** Quem chama precisa saber se o e-mail saiu para dizer a
 * quem administra, mas uma falha aqui não pode desfazer a aprovação que já
 * foi gravada. Sem as variáveis, responde `desligado` em vez de fingir que
 * enviou.
 */

export type EnvioDeEmail = { estado: "enviado" } | { estado: "desligado" } | { estado: "falhou"; motivo: string };

export function emailConfigurado(): boolean {
  return Boolean(env.GMAIL_USUARIO && env.GMAIL_SENHA_APP);
}

export async function enviarEmail(msg: MensagemDeEmail): Promise<EnvioDeEmail> {
  if (!env.GMAIL_USUARIO || !env.GMAIL_SENHA_APP) return { estado: "desligado" };

  const transporte = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.GMAIL_USUARIO, pass: env.GMAIL_SENHA_APP },
    // Sem limite, uma conexão presa seguraria a resposta da aprovação.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    const info = await transporte.sendMail({
      from: { name: "Level Cripto", address: env.GMAIL_USUARIO },
      to: msg.para,
      subject: msg.assunto,
      text: msg.texto,
      html: msg.html,
    });
    // O Gmail aceita a mensagem e devolve o destinatário em `accepted`;
    // sem ele, não houve envio, mesmo sem erro.
    if (!info.accepted?.length) return { estado: "falhou", motivo: "o Gmail não aceitou o destinatário" };
    return { estado: "enviado" };
  } catch (erro) {
    console.error("[email]", erro);
    const codigo = (erro as { code?: string; responseCode?: number }).code;
    const motivo =
      codigo === "EAUTH"
        ? "o Gmail recusou o login (confira a senha de app)"
        : codigo === "ETIMEDOUT" || codigo === "ECONNECTION"
          ? "não consegui falar com o Gmail a tempo"
          : "erro no envio";
    return { estado: "falhou", motivo };
  } finally {
    transporte.close();
  }
}
