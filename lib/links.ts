/**
 * Endereço digitado por alguém que vai virar `href`. Só `http(s)` passa: um
 * `javascript:` num link executaria código ao ser clicado. O formulário já
 * recusa outros esquemas ao salvar; esta é a segunda guarda, na hora de
 * mostrar, para dado antigo ou gravado por outro caminho.
 */
export function urlExterna(valor: string | null | undefined): string | null {
  return valor && /^https?:\/\//i.test(valor.trim()) ? valor.trim() : null;
}
