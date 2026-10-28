/**
 * O e-mail que avisa um membro de que o acesso foi liberado (ARCHITECTURE §27).
 *
 * Só monta o texto: quem envia é `lib/email.ts`. Separado para o teste ler o
 * conteúdo sem abrir conexão com o Gmail.
 *
 * Vai em texto e em HTML. O HTML é simples de propósito (sem imagem, sem CSS
 * externo): cliente de e-mail corta o que não conhece, e imagem remota é um
 * dos sinais que mandam a mensagem para o spam.
 */

export type MensagemDeEmail = { para: string; assunto: string; texto: string; html: string };

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O primeiro nome, para a saudação não sair com o nome completo. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome.trim();
}

export function emailDeAprovacao({ nome, email, site }: { nome: string; email: string; site: string | null }): MensagemDeEmail {
  const ola = primeiroNome(nome);
  const entrar = site ? `${site.replace(/\/$/, "")}/entrar` : null;

  const texto = [
    `Olá, ${ola}!`,
    "",
    "Seu cadastro na Level Cripto foi aprovado e o seu acesso já está liberado.",
    entrar ? `Entre com o e-mail e a senha que você cadastrou: ${entrar}` : "Entre com o e-mail e a senha que você cadastrou.",
    "",
    "Bons farms!",
    "Equipe Level Cripto",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px">
    <p style="margin:0 0 16px;font-size:16px">Olá, ${escapar(ola)}!</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Seu cadastro na <strong>Level Cripto</strong> foi aprovado e o seu acesso já está liberado.</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5">Entre com o e-mail e a senha que você cadastrou.</p>
    ${
      entrar
        ? `<p style="margin:0 0 20px"><a href="${escapar(entrar)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:10px 18px;border-radius:6px">Entrar na Level Cripto</a></p>`
        : ""
    }
    <p style="margin:0;font-size:14px;color:#475569">Bons farms!<br>Equipe Level Cripto</p>
  </div>
</body>
</html>`;

  return { para: email, assunto: "Seu acesso à Level Cripto foi liberado", texto, html };
}
