/**
 * Logo do YouTube em SVG próprio: a biblioteca de ícones do projeto
 * (lucide) não traz mais ícones de marca.
 *
 * Em `currentColor`, não no vermelho da marca: neste sistema vermelho é
 * prejuízo (ARCHITECTURE §14.8), e um ícone vermelho ao lado do nome do
 * projeto seria lido como alerta. O formato do logo, retângulo arredondado
 * com o triângulo de play, já é reconhecível sem a cor.
 */
export function IconeYoutube({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1 31.3 31.3 0 0 0 .5-5.8 31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"
      />
    </svg>
  );
}
