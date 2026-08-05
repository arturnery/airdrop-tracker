import "server-only";
import { env } from "./env";

/**
 * Identidade e autorização.
 *
 * Duas noções distintas, e confundi-las é a origem da maior parte dos vazamentos
 * de dados entre usuários (ARCHITECTURE.md §9.2):
 *
 *  - **viewer** — quem está com a sessão aberta;
 *  - **owner**  — de quem são os dados sendo exibidos.
 *
 * Enquanto não há login os dois coincidem. A partir do momento em que um membro
 * pode abrir o perfil de outro em modo leitura, deixam de coincidir, e toda
 * query precisa saber de quem são os dados que está lendo.
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

/**
 * O e-mail configurado como administrador.
 *
 * Existe para resolver o primeiro acesso: a tela de aprovação exige um admin
 * logado, então a conta que aprova não pode depender de aprovação. Quem se
 * cadastrar com este e-mail nasce `role: "admin"` e `status: "aprovado"`.
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
 * Precisa ser chamada no servidor, em toda rota e Server Action de admin.
 * Esconder o link no menu não protege nada: a URL continua acessível para
 * quem a digitar (ARCHITECTURE.md §9.4).
 */
export async function exigirAdmin(): Promise<void> {
  // Fase 7:
  // const session = await auth();
  // if (session?.user?.role !== "admin") notFound();
  throw new Error(
    "exigirAdmin() só funciona com autenticação ativa — ver ARCHITECTURE.md §9.3.",
  );
}

/**
 * Quem está com a sessão aberta.
 *
 * Fases 1–5 não têm login: devolve o usuário semeado via variável de ambiente.
 * Na fase 6 o corpo passa a ler a sessão do Auth.js — nenhuma query, tabela ou
 * migração muda.
 */
export async function getCurrentUserId(): Promise<string> {
  return env.SEED_USER_ID;

  // Fase 6:
  // const session = await auth();
  // if (!session?.user?.id) redirect("/login");
  // return session.user.id;
}

/**
 * Resolve o que o viewer pode fazer com os dados de `ownerId`.
 *
 * Enquanto só existe o próprio perfil, devolve acesso total. Na fase 7 consulta
 * `profile_settings` e devolve `podeEditar: false` com os campos que o dono
 * liberou — ou `null`, que a rota traduz em 404.
 *
 * A restrição de campos precisa ser aplicada na consulta, não na renderização:
 * dado que não pode ser visto não deve chegar ao cliente para ser escondido
 * por CSS.
 */
export async function resolverAcesso(ownerId?: string): Promise<Acesso | null> {
  const viewerId = await getCurrentUserId();
  const dono = ownerId ?? viewerId;

  if (dono === viewerId) {
    return { ownerId: dono, podeEditar: true, campos: TUDO };
  }

  // Fase 7:
  // const settings = await db.query.profileSettings.findFirst({ ... });
  // if (!settings?.isShared) return null;
  // return { ownerId: dono, podeEditar: false, campos: mapear(settings) };
  return null;
}
