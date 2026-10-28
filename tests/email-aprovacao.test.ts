import { describe, expect, it } from "vitest";

import { emailDeAprovacao } from "@/lib/email-aprovacao";

describe("emailDeAprovacao", () => {
  const base = { nome: "Maria Souza", email: "maria@example.com", site: "https://lvl.example.com" };

  it("vai para o e-mail do cadastro, com o primeiro nome e o link de entrar", () => {
    const m = emailDeAprovacao(base);
    expect(m.para).toBe("maria@example.com");
    expect(m.assunto).toMatch(/liberado/);
    expect(m.texto).toContain("Olá, Maria!");
    expect(m.texto).toContain("https://lvl.example.com/entrar");
    expect(m.html).toContain('href="https://lvl.example.com/entrar"');
  });

  it("não duplica a barra quando o site termina com /", () => {
    expect(emailDeAprovacao({ ...base, site: "https://lvl.example.com/" }).texto).toContain("https://lvl.example.com/entrar");
  });

  it("sem endereço do site, manda o texto sem link nem botão", () => {
    const m = emailDeAprovacao({ ...base, site: null });
    expect(m.texto).not.toContain("http");
    expect(m.html).not.toContain("<a ");
  });

  it("o nome que a pessoa digitou não vira HTML", () => {
    const m = emailDeAprovacao({ ...base, nome: '<img src=x onerror="alert(1)">' });
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img");
  });
});
