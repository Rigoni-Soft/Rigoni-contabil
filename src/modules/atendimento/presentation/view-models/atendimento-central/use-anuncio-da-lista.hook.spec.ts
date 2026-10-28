import { renderHook } from "@testing-library/react";

import { useAnuncioDaLista } from "./use-anuncio-da-lista.hook";

type Espera = { id: string };
type Conversa = { id: string; titulo: string; aguardando: boolean; sinal: string };

const conversa = (id: string, aguardando: boolean, sinal = "s1"): Conversa => ({
  id,
  titulo: `Cliente ${id}`,
  aguardando,
  sinal,
});

function renderizar(inicial: { espera: Espera[]; conversas: Conversa[]; aberto: string | null }) {
  return renderHook((p: typeof inicial) => useAnuncioDaLista(p.espera, p.conversas, p.aberto), {
    initialProps: inicial,
  });
}

describe("useAnuncioDaLista", () => {
  it("a primeira leitura é silenciosa", () => {
    const { result } = renderizar({
      espera: [{ id: "a" }],
      conversas: [conversa("x", true)],
      aberto: null,
    });

    expect(result.current).toBe("");
  });

  it("anuncia cliente novo na espera; quem sai não conta", () => {
    const { result, rerender } = renderizar({
      espera: [{ id: "a" }, { id: "b" }],
      conversas: [],
      aberto: null,
    });

    rerender({ espera: [{ id: "a" }], conversas: [], aberto: null });
    expect(result.current).toBe("");

    rerender({ espera: [{ id: "a" }, { id: "c" }], conversas: [], aberto: null });
    expect(result.current).toBe("Novo cliente em espera. Total na espera: 2.");
  });

  it("um aviso igual ao anterior muda de texto, para o leitor de tela reanunciar", () => {
    const { result, rerender } = renderizar({ espera: [{ id: "a" }], conversas: [], aberto: null });

    rerender({ espera: [{ id: "a" }, { id: "b" }], conversas: [], aberto: null });
    const primeiro = result.current;
    rerender({ espera: [{ id: "a" }], conversas: [], aberto: null });
    rerender({ espera: [{ id: "a" }, { id: "c" }], conversas: [], aberto: null });

    expect(result.current).not.toBe(primeiro);
    expect(result.current.trim()).toBe(primeiro.trim());
  });

  it("anuncia quando o cliente escreve de novo numa conversa que não está aberta", () => {
    const { result, rerender } = renderizar({
      espera: [],
      conversas: [conversa("x", false)],
      aberto: null,
    });

    rerender({ espera: [], conversas: [conversa("x", true, "s2")], aberto: null });
    expect(result.current).toBe("Cliente x escreveu.");
  });

  it("nova mensagem do cliente (outro sinal) também é anunciada", () => {
    const { result, rerender } = renderizar({
      espera: [],
      conversas: [conversa("x", true, "s1")],
      aberto: null,
    });
    expect(result.current).toBe("");

    rerender({ espera: [], conversas: [conversa("x", true, "s2")], aberto: null });
    expect(result.current).toBe("Cliente x escreveu.");
  });

  it("não anuncia a conversa que o usuário está lendo", () => {
    const { result, rerender } = renderizar({
      espera: [],
      conversas: [conversa("x", false)],
      aberto: "x",
    });

    rerender({ espera: [], conversas: [conversa("x", true, "s2")], aberto: "x" });
    expect(result.current).toBe("");
  });

  it("vários clientes viram uma contagem", () => {
    const { result, rerender } = renderizar({
      espera: [],
      conversas: [conversa("x", false), conversa("y", false)],
      aberto: null,
    });

    rerender({
      espera: [],
      conversas: [conversa("x", true, "s2"), conversa("y", true, "s2")],
      aberto: null,
    });
    expect(result.current).toBe("2 clientes escreveram.");
  });
});
