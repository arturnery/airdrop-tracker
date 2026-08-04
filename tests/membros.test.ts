import { describe, expect, it } from "vitest";

import { datasetInicial, HOJE } from "@/db/queries/fixtures";
import * as M from "@/lib/mutations";
import { selectMembros, selectResumoMembros } from "@/lib/selectors";

const base = () => datasetInicial();

describe("selectMembros", () => {
  const membros = selectMembros(base(), HOJE);

  it("ordena de quem espera há mais tempo para o mais recente", () => {
    const datas = membros.map((m) => m.cadastradoEm);
    expect(datas).toEqual([...datas].sort());
  });

  it("calcula há quantos dias cada um espera", () => {
    const ana = membros.find((m) => m.nome === "Ana Beatriz")!;
    // Cadastrou em 25/07; a referência das fixtures é 28/07.
    expect(ana.diasEsperando).toBe(3);
  });
});

describe("selectResumoMembros", () => {
  const resumo = selectResumoMembros(base(), HOJE);

  it("conta cada situação", () => {
    expect(resumo.pendentes).toBe(3);
    expect(resumo.aprovados).toBe(3);
    expect(resumo.recusados).toBe(1);
  });

  it("reporta a espera mais longa da fila", () => {
    expect(resumo.esperaMaisLonga).toBe(3);
  });

  it("sem fila, não há espera para reportar", () => {
    const ds = {
      ...base(),
      members: base().members.filter((m) => m.status !== "pendente"),
    };
    const semFila = selectResumoMembros(ds, HOJE);
    expect(semFila.pendentes).toBe(0);
    expect(semFila.esperaMaisLonga).toBeNull();
  });
});

describe("revisão de acesso", () => {
  it("aprovar tira da fila e registra a data", () => {
    const ds = M.revisarMembro(base(), "mem-01", {
      status: "aprovado",
      note: null,
      revisadoEm: HOJE,
    });
    const membro = ds.members.find((m) => m.id === "mem-01")!;
    expect(membro.status).toBe("aprovado");
    expect(membro.reviewedAt).toBe(HOJE);
    expect(selectResumoMembros(ds, HOJE).pendentes).toBe(2);
  });

  it("recusar guarda o motivo sem apagar o registro", () => {
    const ds = M.revisarMembro(base(), "mem-02", {
      status: "recusado",
      note: "Assinatura cancelada",
      revisadoEm: HOJE,
    });
    const membro = ds.members.find((m) => m.id === "mem-02")!;
    expect(membro.status).toBe("recusado");
    expect(membro.note).toBe("Assinatura cancelada");
    // Continua no dataset: some da fila, não do histórico.
    expect(ds.members).toHaveLength(base().members.length);
  });

  /**
   * Revogar acesso e reconsiderar uma recusa são a mesma operação: devolver
   * para a fila. Em ambos os casos a decisão anterior é limpa.
   */
  it("reabrir devolve para a fila e limpa a decisão anterior", () => {
    const ds = M.reabrirMembro(base(), "mem-04");
    const membro = ds.members.find((m) => m.id === "mem-04")!;
    expect(membro.status).toBe("pendente");
    expect(membro.reviewedAt).toBeNull();
    expect(membro.note).toBeNull();
  });

  it("reconsiderar um recusado apaga o motivo antigo", () => {
    const ds = M.reabrirMembro(base(), "mem-07");
    const membro = ds.members.find((m) => m.id === "mem-07")!;
    expect(membro.status).toBe("pendente");
    expect(membro.note).toBeNull();
  });

  it("não altera o dataset original", () => {
    const original = base();
    const copia = JSON.stringify(original);
    M.revisarMembro(original, "mem-01", {
      status: "aprovado",
      note: null,
      revisadoEm: HOJE,
    });
    M.reabrirMembro(original, "mem-04");
    expect(JSON.stringify(original)).toBe(copia);
  });
});
