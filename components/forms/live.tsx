"use client";

import { useState, type ReactNode } from "react";

import { CampoData } from "@/components/forms/campo-data";
import { BotaoNovo, Formulario } from "@/components/forms/dialogs";
import { DialogoEdicao } from "@/components/forms/editar";
import { CampoArea, CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { useDados } from "@/components/data-provider";
import { diaEHoraDeBrasilia, type Live } from "@/lib/lives";
import { erros, liveSchema } from "@/lib/validators";

/**
 * Cadastro e edição de live do calendário. Os dois diálogos usam os mesmos
 * campos e a mesma validação.
 *
 * As lives não fazem parte do Dataset pessoal, mas as ações passam pelo
 * provider mesmo assim: é ele que segura o diálogo aberto até a tela receber
 * o dado novo. Chamando a Server Action direto, o diálogo fechava e o
 * calendário só mudava um ou dois segundos depois, parecendo que nada tinha
 * acontecido.
 */

type Erros = Record<string, string>;

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "");

function bruto(dados: FormData) {
  return {
    titulo: texto(dados, "titulo"),
    apresentador: texto(dados, "apresentador"),
    descricao: texto(dados, "descricao"),
    link: texto(dados, "link"),
    dia: texto(dados, "dia"),
    hora: texto(dados, "hora"),
    recorrencia: texto(dados, "recorrencia"),
    repetirAte: texto(dados, "repetirAte"),
    destaque: texto(dados, "destaque"),
  };
}

async function enviar(
  dados: FormData,
  acao: (entrada: unknown) => Promise<Erros | null>,
): Promise<Erros | null> {
  const entrada = bruto(dados);
  const validado = liveSchema.safeParse(entrada);
  if (!validado.success) return erros(validado);
  // Objeto bruto para o servidor, que valida de novo com o mesmo schema.
  return acao(entrada);
}

export const ROTULO_RECORRENCIA = {
  nenhuma: "Só esta data",
  semanal: "Toda semana",
  quinzenal: "A cada duas semanas",
} as const;

function CamposLive({ e, inicial, dia }: { e: Erros; inicial?: Live; dia?: string }) {
  const { hoje } = useDados();
  const quando = inicial ? diaEHoraDeBrasilia(inicial.inicioEm) : null;
  const [recorrencia, setRecorrencia] = useState(inicial?.recorrencia ?? "nenhuma");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          label="Tema"
          name="titulo"
          obrigatorio
          defaultValue={inicial?.titulo}
          erro={e.titulo}
          placeholder="Visão de Mercado"
        />
        <CampoTexto
          label="Apresentador"
          name="apresentador"
          defaultValue={inicial?.apresentador ?? undefined}
          erro={e.apresentador}
          placeholder="Papini + Guigo"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoData
          label="Dia"
          name="dia"
          obrigatorio
          defaultValue={quando?.dia ?? dia ?? hoje}
          erro={e.dia}
        />
        <CampoTexto
          label="Horário (Brasília)"
          name="hora"
          type="time"
          obrigatorio
          defaultValue={quando?.hora ?? "19:00"}
          erro={e.hora}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao
          label="Repetir"
          name="recorrencia"
          value={recorrencia}
          onChange={(evento) => setRecorrencia(evento.target.value as typeof recorrencia)}
          erro={e.recorrencia}
          opcoes={Object.entries(ROTULO_RECORRENCIA).map(([valor, rotulo]) => ({ valor, rotulo }))}
        />
        <CampoSelecao
          label="Tipo"
          name="destaque"
          defaultValue={inicial?.destaque ? "sim" : "nao"}
          erro={e.destaque}
          ajuda="O destaque aparece colorido no calendário, para o evento especial do mês."
          opcoes={[
            { valor: "nao", rotulo: "Live normal" },
            { valor: "sim", rotulo: "Evento em destaque" },
          ]}
        />
      </div>
      {/* Só para quem se repete. A programação é montada mês a mês, e sem
          data final uma live que saiu da grade continuaria aparecendo nos
          meses seguintes. */}
      {recorrencia !== "nenhuma" ? (
        <CampoData
          label="Repetir até"
          name="repetirAte"
          defaultValue={inicial?.repetirAte ?? ""}
          erro={e.repetirAte}
          ajuda="Último dia em que ela acontece. Em branco, repete sem data final."
        />
      ) : null}
      <CampoTexto
        label="Link"
        name="link"
        type="url"
        defaultValue={inicial?.link ?? undefined}
        erro={e.link}
        placeholder="https://youtube.com/..."
        ajuda="YouTube, Discord ou onde a live acontecer."
      />
      <CampoArea
        label="Descrição"
        name="descricao"
        defaultValue={inicial?.descricao ?? undefined}
        erro={e.descricao}
        placeholder="O que vai ser tratado"
      />
    </>
  );
}

/**
 * `dia` preenche a data (o "+" de cada célula do calendário), e `gatilho`
 * troca o botão padrão. O gatilho é clonado por `DialogTrigger asChild`, então
 * precisa ser um componente que repassa as props (ver padroes-de-erro, item 1).
 */
export function NovaLive({ dia, gatilho }: { dia?: string; gatilho?: ReactNode }) {
  const { acoes } = useDados();
  return (
    <Formulario
      titulo="Nova live"
      descricao="Aparece no calendário para toda a comunidade."
      gatilho={gatilho ?? <BotaoNovo>Nova live</BotaoNovo>}
      aoEnviar={(dados) => enviar(dados, acoes.criarLive)}
    >
      {({ erros: e }) => <CamposLive e={e} dia={dia} />}
    </Formulario>
  );
}

export function EditarLive({ live }: { live: Live }) {
  const { acoes } = useDados();
  return (
    <DialogoEdicao
      titulo="Editar live"
      descricao={
        live.recorrencia === "nenhuma"
          ? undefined
          : "Esta live se repete: a alteração vale para todas as datas dela."
      }
      rotuloGatilho={`Editar ${live.titulo}`}
      aoEnviar={(dados) => enviar(dados, (entrada) => acoes.atualizarLive(live.id, entrada))}
    >
      {({ erros: e }) => <CamposLive e={e} inicial={live} />}
    </DialogoEdicao>
  );
}
