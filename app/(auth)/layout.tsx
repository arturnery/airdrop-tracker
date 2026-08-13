/**
 * Casca das telas de entrada: um cartão centrado, sem navegação.
 *
 * Quem ainda não entrou não tem para onde navegar: oferecer menu aqui só daria
 * caminhos que terminam em erro de permissão.
 *
 * O fundo tem um brilho radial atrás do cartão, e ele faz trabalho: numa tela
 * escura e vazia, uma superfície plana não indica onde olhar. O brilho cria o
 * ponto focal sem precisar de borda grossa nem sombra pesada.
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
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_35%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)]"
      />

      <main id="conteudo" className="relative w-full max-w-md">
        {children}
      </main>
    </div>
  );
}
