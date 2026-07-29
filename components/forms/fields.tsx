"use client";

import { useId, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Campos de formulário.
 *
 * Regras seguidas em todos: label sempre visível (nunca placeholder no lugar
 * de rótulo), mensagem de erro ligada ao controle por `aria-describedby` e
 * `aria-invalid` para leitores de tela — cor sozinha não comunica o erro.
 */

function Envolucro({
  id,
  label,
  erro,
  ajuda,
  obrigatorio,
  children,
  className,
}: {
  id: string;
  label: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm">
        {label}
        {obrigatorio ? (
          <span className="text-muted-foreground ml-1" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="text-negative text-xs">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={`${id}-ajuda`} className="text-muted-foreground text-xs">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

type BaseProps = {
  label: string;
  name: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  className?: string;
};

export function CampoTexto({
  label,
  name,
  erro,
  ajuda,
  obrigatorio,
  className,
  ...rest
}: BaseProps & React.ComponentProps<"input">) {
  const id = useId();
  return (
    <Envolucro
      id={id}
      label={label}
      erro={erro}
      ajuda={ajuda}
      obrigatorio={obrigatorio}
      className={className}
    >
      <Input
        id={id}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
        {...rest}
      />
    </Envolucro>
  );
}

export function CampoArea({
  label,
  name,
  erro,
  ajuda,
  obrigatorio,
  className,
  ...rest
}: BaseProps & React.ComponentProps<"textarea">) {
  const id = useId();
  return (
    <Envolucro
      id={id}
      label={label}
      erro={erro}
      ajuda={ajuda}
      obrigatorio={obrigatorio}
      className={className}
    >
      <Textarea
        id={id}
        name={name}
        rows={3}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
        {...rest}
      />
    </Envolucro>
  );
}

/**
 * Select nativo em vez do componente do Radix: dentro de um Dialog o Radix
 * Select exige gestão de foco extra e, num formulário simples, o nativo é
 * mais previsível no teclado e no mobile.
 */
export function CampoSelecao({
  label,
  name,
  erro,
  ajuda,
  obrigatorio,
  className,
  opcoes,
  ...rest
}: BaseProps &
  React.ComponentProps<"select"> & {
    opcoes: { valor: string; rotulo: string }[];
  }) {
  const id = useId();
  return (
    <Envolucro
      id={id}
      label={label}
      erro={erro}
      ajuda={ajuda}
      obrigatorio={obrigatorio}
      className={className}
    >
      <select
        id={id}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
        className={cn(
          "border-input bg-transparent text-foreground h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          "[&>option]:bg-popover [&>option]:text-popover-foreground",
        )}
        {...rest}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </Envolucro>
  );
}
