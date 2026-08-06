import "server-only";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { env } from "./env";

/**
 * Identidade e autorização.
 *
 * Duas noções distintas, e confundi-las é a origem da maior parte dos
 * vazamentos de dados entre usuários (ARCHITECTURE.md §9.2):
 *
 *  - **viewer** — quem está com a sessão aberta;
 *  - **owner**  — de quem são os dados sendo exibidos.
 *
 * Hoje os dois coincidem: cada pessoa só vê o próprio perfil. Quando um membro
 * puder abrir o perfil de outro em modo leitura, deixam de coincidir, e toda
 * query passará a receber `ownerId` explicitamente.
 */

/** Campos que o dono liberou para quem visita o perfil. */
export type CamposVisiveis = {
  projetos: boolean;
  tarefas: boolean;
  valores: boolean;
  contas: boolean;
  /** Endereço 0x… — nasce desligado; ver o aviso em ARCHITECTURE.md §9.2. */
  carteiras: boolean;
};

/** Tudo liberado: é o que o dono vê do próprio perfil. */
const TUDO: CamposVisiveis = {
  projetos: true,
  tarefas: true,
  valores: true,
  contas: true,
  carteiras: true,
};

export type Acesso = {
  ownerId: string;
  /** Só é true quando viewer === owner. Server Actions dependem disto. */
  podeEditar: boolean;
  campos: CamposVisiveis;
};

export type Sessao = {
  id: string;
  email: string;
  nome: string;
  papel: "admin" | "membro";
};

/**
 * A sessão atual, ou `null` quando não há.
 *
 * Use quando a ausência de sessão é um caso previsto. Para rotas que exigem
 * login, `exigirSessao()` já redireciona.
 */
export async function sessaoAtual(): Promise<Sessao | null> {
  const sessao = await auth();
  if (!sessao?.user?.id) return null;

  return {
    id: sessao.user.id,
    email: sessao.user.email ?? "",
    nome: sessao.user.name ?? "",
    papel: sessao.user.role,
  };
}

/** A sessão, ou redirecionamento para a tela de entrada. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  return sessao;
}

/**
 * Id do usuário da requisição atual.
 *
 * Toda query e toda escrita usam este valor. Ele vem da sessão assinada,
 * nunca de parâmetro ou de formulário: aceitar um id enviado pelo cliente
 * permitiria ler e escrever no espaço de outra pessoa.
 */
export async function getCurrentUserId(): Promise<string> {
  const sessao = await exigirSessao();
  return sessao.id;
}

/**
 * O e-mail configurado como administrador.
 *
 * Resolve o primeiro acesso: a tela de aprovação exige um admin logado, então
 * a conta que aprova não pode depender de aprovação. Quem se cadastrar com
 * este e-mail nasce `role: "admin"` e `status: "aprovado"`.
 *
 * A variável não guarda senha — apenas identifica o dono. Trocar o valor depois
 * não rebaixa quem já é admin, porque o papel fica gravado no banco.
 */
export function ehEmailDeAdmin(email: string): boolean {
  return email.trim().toLowerCase() === env.ADMIN_EMAIL;
}

/**
 * Guarda das rotas de administração.
 *
 * Chamada no servidor, antes de qualquer consulta. Esconder o link no menu não
 * protege nada: a URL continua acessível para quem a digitar (§9.4).
 *
 * Quem não é administrador recebe redirecionamento para a raiz, não uma
 * mensagem de "acesso negado" — confirmar que a rota existe já é informação.
 */
export async function exigirAdmin(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== "admin") redirect("/");
  return sessao;
}

/**
 * Resolve o que o viewer pode fazer com os dados de `ownerId`.
 *
 * Enquanto só existe o próprio perfil, devolve acesso total ao dono e nada
 * para os demais. Quando os perfis compartilhados entrarem (fase 8), consulta
 * `profile_settings` e devolve `podeEditar: false` com os campos liberados.
 */
export async function resolverAcesso(ownerId?: string): Promise<Acesso | null> {
  const viewerId = await getCurrentUserId();
  const dono = ownerId ?? viewerId;

  if (dono === viewerId) {
    return { ownerId: dono, podeEditar: true, campos: TUDO };
  }
  return null;
}
