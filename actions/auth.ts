"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ehEmailDeAdmin } from "@/lib/auth";
import { gerarHash } from "@/lib/senha";
import {
  cadastroSchema,
  erros,
  loginSchema,
  recuperarSenhaSchema,
} from "@/lib/validators";

/**
 * Ações de entrada.
 *
 * **A navegação acontece no servidor, via `redirect()`.** A primeira versão
 * devolvia o destino e o formulário chamava `router.push()` seguido de
 * `router.refresh()`: e o refresh atropelava a navegação pendente: o servidor
 * renderizava a página nova, mas a tela não trocava.
 *
 * Com `redirect()` a resposta da ação já é o redirecionamento, então não há
 * duas navegações competindo. O retorno destas funções passa a existir apenas
 * para o caso de erro.
 */
export type ErroAuth = { erros: Record<string, string> };

/**
 * Entrada no sistema.
 *
 * A mensagem de recusa é sempre a mesma, qualquer que seja a causa: senha
 * errada, e-mail inexistente ou conta ainda não aprovada. Distinguir os casos
 * transformaria a tela num verificador de quem tem conta: e revelaria quem já
 * foi aprovado.
 */
export async function entrar(entrada: unknown): Promise<ErroAuth | void> {
  const analisado = loginSchema.safeParse(entrada);
  if (!analisado.success) return { erros: erros(analisado) };

  try {
    await signIn("credentials", {
      email: analisado.data.email,
      password: analisado.data.password,
      redirect: false,
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return {
        erros: { geral: "E-mail ou senha incorretos, ou acesso ainda não liberado." },
      };
    }
    throw erro;
  }

  // Fora do try: `redirect` funciona lançando uma exceção interna, que um
  // catch genérico engoliria.
  redirect("/");
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/entrar" });
}

/**
 * Cadastro.
 *
 * A conta nasce `pendente`: o acesso é liberado manualmente na área de
 * administração. A exceção é o e-mail configurado em `ADMIN_EMAIL`, que nasce
 * administrador e aprovado: sem isso não haveria quem aprovasse o primeiro.
 *
 * **E-mail já cadastrado é recusado com mensagem explícita**, por decisão do
 * autor: quem tentava recadastrar não entendia o que acontecia, e a alternativa
 * silenciosa custava mais em confusão do que rendia em proteção.
 *
 * A contrapartida assumida: o formulário confirma se um endereço tem conta, o
 * que permite mapear membros testando e-mails. Aceitável para uma comunidade
 * fechada e pequena; se um dia o cadastro for exposto a público amplo, vale
 * rever para uma resposta que não distingue os casos.
 *
 * A exceção é a conta semeada pelo administrador, que existe sem senha: nela o
 * cadastro define a senha em vez de recusar, ou o primeiro acesso ficaria
 * impossível.
 */
export async function cadastrar(entrada: unknown): Promise<ErroAuth | void> {
  const analisado = cadastroSchema.safeParse(entrada);
  if (!analisado.success) return { erros: erros(analisado) };

  const { name, email, password } = analisado.data;
  let destino: string;

  try {
    const [existente] = await db
      .select({
        id: schema.users.id,
        passwordHash: schema.users.passwordHash,
        status: schema.users.status,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    const hash = await gerarHash(password);

    if (existente) {
      // Conta com senha definida: recusa, e a pessoa entra pelo login.
      if (existente.passwordHash) {
        return {
          erros: {
            geral:
              "Esse e-mail já tem conta. Entre com sua senha, ou use \"Esqueci minha senha\" se não lembrar dela.",
          },
        };
      }

      /*
       * Sem senha é a conta semeada por `npm run db:seed`, criada antes de o
       * administrador definir a dele. Aqui o cadastro completa o registro em
       * vez de recusar, ou o primeiro acesso ficaria impossível.
       */
      await db
        .update(schema.users)
        .set({ name, passwordHash: hash })
        .where(eq(schema.users.id, existente.id));

      destino =
        existente.status === "aprovado" ? "/entrar" : "/aguardando-aprovacao";
    } else {
      const admin = ehEmailDeAdmin(email);

      await db.insert(schema.users).values({
        name,
        email,
        passwordHash: hash,
        role: admin ? "admin" : "membro",
        status: admin ? "aprovado" : "pendente",
        reviewedAt: admin ? new Date() : null,
      });

      destino = admin ? "/entrar" : "/aguardando-aprovacao";
    }
  } catch (erro) {
    console.error("[cadastro]", erro);
    return {
      erros: { geral: "Não foi possível concluir o cadastro. Tente de novo." },
    };
  }

  redirect(destino);
}

// ------------------------------------------------------- recuperação de senha

/** Uma solicitação por conta a cada 24 horas. */
const INTERVALO_PEDIDO_MS = 24 * 60 * 60 * 1000;

export type ResultadoPedido =
  | { ok: true; aviso: string }
  | { ok: false; erros: Record<string, string> };

/**
 * Registra um pedido de redefinição de senha.
 *
 * **A resposta é sempre a mesma**, exista a conta ou não. Confirmar que o
 * endereço está cadastrado transformaria esta tela num verificador de quem tem
 * acesso, que é a mesma razão de a recusa de login ser única. A diferença fica
 * no banco: sem conta, nenhuma linha é criada e nada aparece na administração.
 *
 * Não há envio automático de e-mail, e para uma comunidade fechada com
 * aprovação manual isso é infraestrutura que não se paga. O pedido entra numa
 * fila que quem administra resolve gerando uma senha temporária.
 */
export async function pedirRedefinicaoDeSenha(
  entrada: unknown,
): Promise<ResultadoPedido> {
  const analisado = recuperarSenhaSchema.safeParse(entrada);
  if (!analisado.success) return { ok: false, erros: erros(analisado) };

  const aviso =
    "Pedido registrado. Em breve você recebe por e-mail uma senha temporária. " +
    "Se não chegar, confira se este é mesmo o endereço do seu cadastro.";

  try {
    const [usuario] = await db
      .select({ id: schema.users.id, isDemo: schema.users.isDemo })
      .from(schema.users)
      .where(eq(schema.users.email, analisado.data.email))
      .limit(1);

    // Sem conta: mesma resposta, nenhum registro. A conta de demonstração
    // também não entra na fila, já que a senha dela é pública e fixa.
    if (!usuario || usuario.isDemo) return { ok: true, aviso };

    const [ultimo] = await db
      .select({ requestedAt: schema.passwordResetRequests.requestedAt })
      .from(schema.passwordResetRequests)
      .where(eq(schema.passwordResetRequests.userId, usuario.id))
      .orderBy(desc(schema.passwordResetRequests.requestedAt))
      .limit(1);

    if (ultimo) {
      const desde = Date.now() - ultimo.requestedAt.getTime();

      /*
       * Já pediu nas últimas 24h: não cria outra linha, e responde o mesmo de
       * sempre.
       *
       * A versão anterior avisava "já existe um pedido em andamento", com a
       * justificativa de que só quem tem conta chega a ter pedido anterior.
       * O raciocínio estava invertido: era justamente isso que vazava. Bastava
       * enviar o mesmo e-mail duas vezes e ler a segunda resposta, porque a
       * mensagem diferente só aparecia para endereços cadastrados. A recusa
       * única do login não protegeria nada com essa porta aberta ao lado.
       *
       * O que se perde é pequeno: quem pediu de novo por não ter recebido lê a
       * mesma frase, que já explica que a senha chega por e-mail.
       */
      if (desde < INTERVALO_PEDIDO_MS) return { ok: true, aviso };
    }

    await db
      .insert(schema.passwordResetRequests)
      .values({ userId: usuario.id });

    return { ok: true, aviso };
  } catch (erro) {
    console.error("[recuperar-senha]", erro);
    // Falha de infraestrutura não deve revelar nada: mesma resposta de sempre.
    return { ok: true, aviso };
  }
}
