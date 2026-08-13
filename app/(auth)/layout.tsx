/**
 * Casca das telas de entrada: um cartão centrado, sem navegação.
 *
 * Quem ainda não entrou não tem para onde navegar: oferecer menu aqui só daria
 * caminhos que terminam em erro de permissão.
 *
 * O fundo tem um brilho radial atrás do cartão, e ele faz trabalho: numa tela
 * escura e vazia, uma superfície plana não indica onde olhar. O brilho cria o
 * ponto focal sem precisar de borda grossa nem sombra pesada.
 *
 * A cor é a da marca, não a primária do sistema. É a regra registrada em
 * ARCHITECTURE §14.8: o verde carrega significado (ganho, conclusão) e não
 * empresta para identidade; superfície e brilho são justamente onde o azul da
 * marca cabe sem disputar leitura com nada.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      {/*
        Decoração pura: `aria-hidden` porque não carrega informação, e leitor de
        tela anunciando "imagem" aqui seria ruído antes do formulário.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(65%_55%_at_50%_30%,color-mix(in_oklch,var(--brand)_18%,transparent),transparent_70%)]"
      />

      <main id="conteudo" className="relative w-full max-w-md">
        {children}
      </main>
    </div>
  );
}
