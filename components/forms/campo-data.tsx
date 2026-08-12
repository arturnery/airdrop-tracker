"use client";

import { useState } from "react";

import { CampoTexto } from "@/components/forms/fields";
import { formatDateExtenso } from "@/lib/dates";

/**
 * Campo de data que confirma, por extenso, o dia escolhido.
 *
 * `<input type="date">` guarda sempre `aaaa-mm-dd`, mas **exibe** no formato da
 * preferência de idioma do navegador. Com o navegador em inglês, aparece
 * `mm/dd/aaaa` mesmo com a página em `lang="pt-BR"`, e isso não é configurável
 * por HTML ou CSS: quem decide é o navegador, não o site.
 *
 * Trocar por um seletor próprio resolveria a exibição e custaria caro: o campo
 * nativo traz calendário do sistema, navegação por teclado, leitor de tela e
 * teclado numérico no celular, tudo de graça e testado.
 *
 * Então o campo continua nativo e a data escolhida aparece embaixo **por
 * extenso**. A primeira versão mostrava `dd/mm/aaaa` ali, e isso piorava o
 * problema: ver "11/08/2026" logo abaixo de um campo exibindo "08/11/2026"
 * levanta a dúvida em vez de resolvê-la, porque são a mesma data e parecem
 * duas. "11 de agosto de 2026" não tem ordem a interpretar.
 */
export function CampoData({
  label,
  name,
  defaultValue = "",
  erro,
  ajuda,
  obrigatorio,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
}) {
  const [valor, setValor] = useState(defaultValue);

  return (
    <div>
      <CampoTexto
        label={label}
        name={name}
        type="date"
        obrigatorio={obrigatorio}
        value={valor}
        onChange={(evento) => setValor(evento.target.value)}
        erro={erro}
        ajuda={ajuda}
      />
      {/^\d{4}-\d{2}-\d{2}$/.test(valor) ? (
        <p className="text-muted-foreground mt-1 text-xs" aria-live="polite">
          <strong className="text-foreground font-medium">
            {formatDateExtenso(valor)}
          </strong>
        </p>
      ) : null}
    </div>
  );
}
