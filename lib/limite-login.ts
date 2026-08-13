/**
 * Limite de tentativas de login.
 *
 * Cinco falhas em quinze minutos bloqueiam o e-mail pelo resto da janela. Os
 * números vêm de um equilíbrio: baixo o bastante para inviabilizar tentativa e
 * erro, alto o bastante para quem erra a própria senha algumas vezes não ficar
 * de fora do sistema.
 *
 * **A recusa por bloqueio é idêntica à recusa por senha errada.** Distinguir as
 * duas diria a quem está tentando que aquele endereço existe e está sendo
 * protegido, que é exatamente a informação que a recusa única esconde.
 *
 * O bloqueio é por e-mail, não por IP, e isso tem um custo conhecido: alguém
 * pode travar a conta de outra pessoa por quinze minutos de propósito. Aceito
 * porque a alternativa protege menos: IP em serverless chega por cabeçalho, que
 * o cliente influencia, e um ataque distribuído troca de IP a cada tentativa
 * enquanto o e-mail alvo continua o mesmo.
 *
 * A decisão mora em `bloqueadoPor`, que é pura e recebe o instante atual. O
 * banco só entrega os carimbos de tempo. Assim a regra que importa pode ser
 * testada sem subir Postgres, e a janela deixa de depender do relógio do
 * processo.
 */
export const LIMITE = 5;
export const JANELA_MINUTOS = 15;

const JANELA_MS = JANELA_MINUTOS * 60 * 1000;

/**
 * `tentativas` são os carimbos das falhas mais recentes daquele e-mail, da mais
 * nova para a mais antiga. Bastam `LIMITE` delas: se as cinco últimas couberem
 * na janela, está bloqueado, e o que veio antes não muda a resposta.
 */
export function bloqueadoPor(tentativas: Date[], agora: Date): boolean {
  const dentroDaJanela = tentativas.filter(
    (quando) => agora.getTime() - quando.getTime() < JANELA_MS,
  );

  return dentroDaJanela.length >= LIMITE;
}
