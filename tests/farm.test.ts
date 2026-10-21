import { describe, expect, it } from "vitest";

import { emptyDataset, type Dataset } from "@/lib/dataset";
import { destaquesParaAdicionar, mudancaDoDestaque, podeFarmar } from "@/lib/farm";
import { criarProjeto, adotarDoCatalogo } from "@/lib/mutations";

type Projeto = Dataset["projects"][number];
type Destaque = Dataset["catalogProjects"][number];

const destaque = (extra: Partial<Destaque> = {}): Destaque => ({
  id: "cat-astra",
  slug: "astra",
  name: "Astra Points",
  category: "interacoes",
  pointsLabel: null,
  chain: null,
  priority: 3,
  status: "ativo",
  websiteUrl: null,
  discordUrl: null,
  twitterUrl: null,
  docsUrl: null,
  expectedTgeDate: null,
  summary: null,
  createdBy: "admin",
  sourceProjectId: "prj-do-admin",
  publishedAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

const projeto = (extra: Partial<Projeto> = {}): Projeto => ({
  id: "prj-1",
  slug: "p",
  name: "Outro",
  status: "ativo",
  category: null,
  pointsLabel: null,
  chain: null,
  priority: 2,
  websiteUrl: null,
  discordUrl: null,
  twitterUrl: null,
  docsUrl: null,
  tutorialUrl: null,
  expectedTgeDate: null,
  notes: null,
  adoptedFromId: null,
  farmando: false,
  saidaDoFarmMotivo: null,
  saidaDoFarmEm: null,
  statusDoDestaqueVisto: null,
  ...extra,
});

const ds = (projects: Projeto[], catalogProjects: Destaque[]): Dataset => ({
  ...emptyDataset(),
  projects,
  catalogProjects,
});

describe("podeFarmar", () => {
  it("só ativo e TGE anunciado entram no farm", () => {
    expect(podeFarmar("ativo")).toBe(true);
    expect(podeFarmar("tge_anunciado")).toBe(true);
    for (const s of ["pesquisando", "pausado", "distribuido", "descartado"] as const) {
      expect(podeFarmar(s)).toBe(false);
    }
  });
});

describe("destaquesParaAdicionar", () => {
  it("oferece o destaque ativo que a pessoa não tem", () => {
    expect(destaquesParaAdicionar(ds([], [destaque()]))).toHaveLength(1);
  });

  it("não oferece destaque pausado, distribuído ou despublicado", () => {
    expect(destaquesParaAdicionar(ds([], [destaque({ status: "pausado" })]))).toHaveLength(0);
    expect(destaquesParaAdicionar(ds([], [destaque({ status: "distribuido" })]))).toHaveLength(0);
    expect(destaquesParaAdicionar(ds([], [destaque({ publishedAt: null })]))).toHaveLength(0);
  });

  it("não oferece o que ela já tem: adotado, dela mesma ou com o mesmo nome", () => {
    expect(destaquesParaAdicionar(ds([projeto({ adoptedFromId: "cat-astra" })], [destaque()]))).toHaveLength(0);
    expect(destaquesParaAdicionar(ds([projeto({ id: "prj-do-admin" })], [destaque()]))).toHaveLength(0);
    expect(destaquesParaAdicionar(ds([projeto({ name: "astra points" })], [destaque()]))).toHaveLength(0);
  });

  it("continua não oferecendo depois que ela tirou do farm", () => {
    const tirado = projeto({ adoptedFromId: "cat-astra", status: "pausado", farmando: false });
    expect(destaquesParaAdicionar(ds([tirado], [destaque()]))).toHaveLength(0);
  });
});

describe("mudancaDoDestaque", () => {
  const adotado = (extra: Partial<Projeto> = {}) =>
    projeto({ adoptedFromId: "cat-astra", statusDoDestaqueVisto: "ativo", farmando: true, ...extra });

  it("avisa quando o admin muda o status do destaque", () => {
    expect(mudancaDoDestaque(adotado(), [destaque({ status: "distribuido" })])).toBe("distribuido");
  });

  it("some depois de respondido (o status atual conta como visto)", () => {
    expect(
      mudancaDoDestaque(adotado({ statusDoDestaqueVisto: "distribuido" }), [destaque({ status: "distribuido" })]),
    ).toBeNull();
  });

  it("não avisa quem já está no mesmo status por conta própria", () => {
    expect(mudancaDoDestaque(adotado({ status: "pausado" }), [destaque({ status: "pausado" })])).toBeNull();
  });

  it("não avisa projeto cadastrado à mão nem destaque que saiu do catálogo", () => {
    expect(mudancaDoDestaque(projeto(), [destaque({ status: "pausado" })])).toBeNull();
    expect(mudancaDoDestaque(adotado(), [])).toBeNull();
  });
});

describe("entrada no farm", () => {
  const base = {
    name: "Novo",
    category: null,
    pointsLabel: null,
    chain: null,
    priority: 2,
    websiteUrl: null,
    discordUrl: null,
    twitterUrl: null,
    docsUrl: null,
    tutorialUrl: null,
    expectedTgeDate: null,
    notes: null,
  };

  it("projeto criado ativo entra no farm; criado em estudo, não", () => {
    const ativo = criarProjeto(emptyDataset(), { ...base, status: "ativo" });
    expect(ativo.dataset.projects[0]!.farmando).toBe(true);
    const estudo = criarProjeto(emptyDataset(), { ...base, status: "pesquisando" });
    expect(estudo.dataset.projects[0]!.farmando).toBe(false);
  });

  it("adicionar um destaque entra no farm e marca o status dele como visto", () => {
    const r = adotarDoCatalogo(ds([], [destaque({ status: "tge_anunciado" })]), { catalogId: "cat-astra" });
    expect(r!.dataset.projects[0]).toMatchObject({ farmando: true, statusDoDestaqueVisto: "tge_anunciado" });
  });
});
