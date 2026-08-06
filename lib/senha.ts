import "server-only";
import bcrypt from "bcryptjs";

/**
 * Hash de senha.
 *
 * O banco guarda o hash, nunca a senha. Não existe operação de "ler a senha" —
 * só de verificar se a que foi digitada bate com o hash guardado. Nem quem tem
 * acesso ao banco consegue recuperá-la.
 *
 * `bcryptjs` em vez de `argon2`: argon2id é mais resistente, mas depende de
 * binário nativo, que complica o deploy serverless. bcrypt com custo 12 é
 * seguro para o tamanho deste problema, e a escolha está registrada para ser
 * revista se o contexto mudar.
 */

/** Custo 12: ~250ms por verificação, o que torna força bruta cara. */
const CUSTO = 12;

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

/**
 * Confere a senha contra o hash.
 *
 * Quando não há hash — conta criada pelo seed, ainda sem senha — devolve falso
 * **depois** de um hash descartável. Sem isso, uma conta sem senha responderia
 * instantaneamente e o tempo de resposta revelaria quais e-mails existem.
 */
export async function conferirSenha(
  senha: string,
  hash: string | null,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.hash(senha, CUSTO);
    return false;
  }
  return bcrypt.compare(senha, hash);
}
