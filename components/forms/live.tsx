"use client";

import { CampoData } from "@/components/forms/campo-data";
import { BotaoNovo, Formulario } from "@/components/forms/dialogs";
import { DialogoEdicao } from "@/components/forms/editar";
import { CampoArea, CampoSelecao, CampoTexto } from "@/components/forms/fields";
import { useDados } from "@/components/data-provider";
import { diaEHoraDeBrasilia, type Live } from "@/lib/lives";
import { erros, liveSchema } from "@/lib/validators";

/**
 * Cadastro e edição de live. Os dois diálogos usam os mesmos campos e a mesma
 * validação.
 *
 * As lives não fazem parte do Dataset pessoal, mas as ações passam pelo
 * provider mesmo assim: é ele que segura o diálogo aberto até a tela receber
 * o dado novo. Chamando a Server Action direto, o diálogo fechava e a lista
 * só mudava um ou dois segundos depois, parecendo que nada tinha acontecido.
 */

type Erros = Record<string, string>;

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "");

function bruto(dados: FormData) {
  return {
    titulo: texto(dados, "titulo"),
    descricao: texto(dados, "descricao"),
    link: texto(dados, "link"),
    dia: texto(dados, "dia"),
    hora: texto(dados, "hora"),
    semanal: texto(dados, "semanal"),
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

function CamposLive({ e, inicial }: { e: Erros; inicial?: Live }) {
  const { hoje } = useDados();
  const quando = inicial ? diaEHoraDeBrasilia(inicial.inicioEm) : null;

  return (
    <>
      <CampoTexto
        label="Título"
        name="titulo"
        obrigatorio
        defaultValue={inicial?.titulo}
        erro={e.titulo}
        placeholder="Live semanal: análise de airdrops"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoData
          label="Dia"
          name="dia"
          obrigatorio
          defaultValue={quando?.dia ?? hoje}
          erro={e.dia}
        />
        <CampoTexto
          label="Horário (Brasília)"
          name="hora"
          type="time"
          obrigatorio
          defaultValue={quando?.hora ?? "20:00"}
          erro={e.hora}
        />
      </div>
      <CampoSelecao
        label="Repetir"
        name="semanal"
        defaultValue={inicial?.semanal ? "sim" : "nao"}
        erro={e.semanal}
        ajuda="Toda semana: a live aparece no mesmo dia da semana e horário, até ser excluída."
        opcoes={[
          { valor: "nao", rotulo: "Só esta data" },
          { valor: "sim", rotulo: "Toda semana" },
        ]}
      />
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

export function NovaLive() {
  const { acoes } = useDados();
  return (
    <Formulario
      titulo="Nova live"
      descricao="Aparece para toda a comunidade, na página de lives."
      gatilho={<BotaoNovo>Nova live</BotaoNovo>}
      aoEnviar={(dados) => enviar(dados, acoes.criarLive)}
    >
      {({ erros: e }) => <CamposLive e={e} />}
    </Formulario>
  );
}

export function EditarLive({ live }: { live: Live }) {
  const { acoes } = useDados();
  return (
    <DialogoEdicao
      titulo="Editar live"
      rotuloGatilho={`Editar ${live.titulo}`}
      aoEnviar={(dados) => enviar(dados, (entrada) => acoes.atualizarLive(live.id, entrada))}
    >
      {({ erros: e }) => <CamposLive e={e} inicial={live} />}
    </DialogoEdicao>
  );
}
