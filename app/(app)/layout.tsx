import { CascaApp } from "@/components/casca-app";
import { TrocaObrigatoria } from "@/components/views/troca-obrigatoria";
import { carregarUsuario } from "@/db/queries/usuario";
import { contarNaoLidos } from "@/actions/feedback";
import { exigirSessao } from "@/lib/auth";
import { contarNovidadesNaoVistas } from "@/lib/changelog";

/**
 * Casca do aplicativo: navegação lateral e área de conteúdo.
 *
 * Separada do layout raiz porque as telas de entrada (`app/(auth)`) não têm
 * barra lateral: quem ainda não entrou não tem para onde navegar.
 *
 * O visual mora em `CascaApp`, que é componente de cliente porque a barra
 * recolhe. Aqui ficam sessão, permissão e dados: o que decide **o que pode ser
 * visto** permanece no servidor, e a divisão importa justamente por isso.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Toda rota do aplicativo exige sessão. A verificação é do servidor: não
  // adianta o menu esconder o link se a URL continua acessível.
  const sessao = await exigirSessao();

  /*
   * O nome vem do banco, não do token: o JWT é assinado no login e congela o
   * nome daquele momento, então trocá-lo no perfil não mudaria a barra lateral
   * até sair e entrar de novo. Identidade continua vindo da sessão.
   */
  const usuario = await carregarUsuario(sessao.id);
  const nomeExibido = usuario?.nome ?? sessao.nome;

  /*
   * A contagem só é consultada para quem administra: ela lê a tabela inteira,
   * sem filtro por usuário, e não deve custar uma consulta a cada navegação de
   * quem nunca vai ver o número.
   */
  const naoLidos = sessao.papel === "admin" ? await contarNaoLidos() : 0;

  const novidadesNaoVistas = contarNovidadesNaoVistas(
    usuario?.novidadesVistasVersao ?? null,
  );

  /*
   * Senha temporária trava o sistema na própria troca.
   *
   * Quem administra viu essa senha ao gerá-la, então ela não pode continuar
   * valendo enquanto a pessoa usa o sistema.
   *
   * O layout **substitui** o conteúdo em vez de redirecionar. Redirecionar
   * exigiria saber a rota atual, que um layout não recebe, e como este layout
   * envolve toda rota autenticada, trocar o conteúdo bloqueia todas de uma vez:
   * uma tela nova nasce protegida sem ninguém precisar lembrar.
   *
   * Isso é a camada visual. A que vale está em `actions/_core.ts`, que recusa
   * qualquer escrita nesse estado: esconder a tela não impediria a requisição
   * direta à Server Action.
   */
  if (usuario?.precisaTrocarSenha) {
    return <TrocaObrigatoria nome={nomeExibido} />;
  }

  return (
    <CascaApp
      nome={nomeExibido}
      ehAdmin={sessao.papel === "admin"}
      feedbackNaoLido={naoLidos}
      novidadesNaoVistas={novidadesNaoVistas}
    >
      {children}
    </CascaApp>
  );
}
