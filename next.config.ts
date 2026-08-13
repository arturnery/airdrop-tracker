import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança, aplicados a toda resposta.
 *
 * A Vercel já envia `Strict-Transport-Security`; o resto é responsabilidade da
 * aplicação. Cada um aqui fecha um caminho concreto:
 *
 *  - **X-Frame-Options / frame-ancestors**: sem eles, qualquer site pode
 *    embutir o app num iframe invisível e capturar cliques de quem está
 *    logado (clickjacking). Num sistema onde um clique aprova membro ou apaga
 *    projeto, isso é o buraco mais sério da lista.
 *  - **nosniff**: impede o navegador de adivinhar o tipo de um arquivo e
 *    executar como script algo que foi servido como texto.
 *  - **Referrer-Policy**: sem ela, clicar num link externo enviaria a URL
 *    completa ao destino, incluindo o slug do projeto que estava aberto.
 *  - **Permissions-Policy**: desliga câmera, microfone e geolocalização, que o
 *    sistema não usa. Se um dia usar, a linha muda junto.
 *
 * Não há Content-Security-Policy aqui, e a ausência é deliberada: uma CSP que
 * não contemple os scripts inline do Next quebra a hidratação, e uma que
 * libere `unsafe-inline` para não quebrar não protege de quase nada. Fazer
 * direito exige nonce por requisição, que fica registrado como próximo passo.
 */
const cabecalhosDeSeguranca = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Equivalente moderno do X-Frame-Options, respeitado por navegadores novos.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
};

export default nextConfig;
