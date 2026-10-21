"use client";

import { useState } from "react";
import { BellRing, LogOut, Sprout } from "lucide-react";

import { Formulario } from "@/components/forms/dialogs";
import { CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { useDados } from "@/components/data-provider";
import { projectLabels } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { MOTIVOS_DE_SAIDA } from "@/lib/farm";
import type { ProjectStatus, ProjectSummary } from "@/lib/types";
import { erros, saidaDoFarmSchema } from "@/lib/validators";

/**
 * Os três controles da aba "Farmando agora" (ARCHITECTURE §21): entrar no
 * farm, sair dele dizendo o motivo, e responder ao aviso de que quem
 * administra mudou o status do destaque. Ficam por cima do link esticado do
 * card (`relative z-10`), senão o clique abriria o projeto.
 */

/** Entra em "Farmando agora". Só aparece em projeto ativo fora do farm. */
export function BotaoFarmar({ projeto }: { projeto: ProjectSummary }) {
  const { acoes, salvando } = useDados();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="relative z-10 flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2 text-xs"
        disabled={salvando}
        onClick={async () => {
          setErro(null);
          const falha = await acoes.farmarProjeto(projeto.id);
          if (falha) setErro(Object.values(falha)[0] ?? "Não deu certo.");
        }}
      >
        <Sprout className="size-3.5" aria-hidden="true" />
        Farmar
      </Button>
      {erro ? (
        <p role="alert" className="text-negative text-xs">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sai do farm. O motivo é obrigatório e vira o status do projeto: não existe
 * parar de farmar e continuar "ativo".
 */
export function TirarDoFarm({ projeto }: { projeto: ProjectSummary }) {
  const { acoes } = useDados();
  return (
    <Formulario
      titulo={`Tirar ${projeto.nome} do farm`}
      descricao="O projeto sai de Farmando agora e continua em Todos os projetos, com o motivo registrado. Os lançamentos e o histórico ficam."
      gatilho={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground relative z-10 h-7 gap-1 px-2 text-xs"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Tirar do farm
        </Button>
      }
      rotuloEnvio="Tirar do farm"
      aoEnviar={(dados) => {
        const bruto = {
          id: projeto.id,
          status: String(dados.get("status") ?? ""),
          observacao: String(dados.get("observacao") ?? ""),
        };
        const validado = saidaDoFarmSchema.safeParse(bruto);
        if (!validado.success) return erros(validado);
        return acoes.tirarDoFarm(bruto);
      }}
    >
      {({ erros: e }) => (
        <>
          <CampoSelecao
            label="Por que está saindo?"
            name="status"
            obrigatorio
            erro={e.status}
            ajuda="O projeto passa a ter este status."
            opcoes={MOTIVOS_DE_SAIDA.map((m) => ({
              valor: m.status,
              rotulo: `${m.rotulo} (${projectLabels[m.status]})`,
            }))}
          />
          <CampoTexto
            label="Detalhe (opcional)"
            name="observacao"
            erro={e.observacao}
            placeholder="Ex.: recebi o airdrop em outubro"
            autoComplete="off"
          />
        </>
      )}
    </Formulario>
  );
}

/**
 * "O admin marcou como Distribuído": aparece no projeto que veio de um
 * destaque cujo status mudou. A pessoa decide; nada muda sozinho.
 */
export function AvisoMudancaDoDestaque({
  projeto,
  novo,
}: {
  projeto: ProjectSummary;
  novo: ProjectStatus;
}) {
  const { acoes, salvando } = useDados();
  const responder = (aceitar: boolean) =>
    acoes.responderMudancaDoDestaque({ id: projeto.id, aceitar });
  return (
    <div
      role="status"
      className="border-caution/40 bg-caution/10 relative z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
    >
      <span className="flex items-center gap-1.5">
        <BellRing className="text-caution size-3.5 shrink-0" aria-hidden="true" />
        <span>
          O admin marcou este projeto como{" "}
          <strong className="font-semibold">{projectLabels[novo]}</strong>.
        </span>
      </span>
      <span className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={salvando} onClick={() => responder(true)}>
          Atualizar o meu
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={salvando} onClick={() => responder(false)}>
          Manter
        </Button>
      </span>
    </div>
  );
}
