import { act, renderHook } from "@testing-library/react";

import { useArrastarArquivo } from "./use-arrastar-arquivo.hook";

const ARQUIVO = new File(["x"], "a.pdf", { type: "application/pdf" });
const evento = (types: string[], files: File[] = []) =>
  ({
    dataTransfer: { types, files },
    preventDefault: jest.fn(),
  }) as unknown as React.DragEvent;

describe("useArrastarArquivo", () => {
  it("acende ao entrar com arquivo, aguenta entrada e saída dos filhos e apaga ao sair de vez", () => {
    const { result } = renderHook(() => useArrastarArquivo(jest.fn()));

    act(() => result.current.ligacoes!.onDragEnter(evento(["Files"])));
    act(() => result.current.ligacoes!.onDragEnter(evento(["Files"])));
    expect(result.current.arrastando).toBe(true);

    act(() => result.current.ligacoes!.onDragLeave(evento(["Files"])));
    expect(result.current.arrastando).toBe(true);
    act(() => result.current.ligacoes!.onDragLeave(evento(["Files"])));
    expect(result.current.arrastando).toBe(false);
  });

  it("arrastar texto ou link não acende nem aceita soltar", () => {
    const aoSoltar = jest.fn();
    const { result } = renderHook(() => useArrastarArquivo(aoSoltar));
    const texto = evento(["text/plain"], [ARQUIVO]);

    act(() => result.current.ligacoes!.onDragEnter(texto));
    act(() => result.current.ligacoes!.onDragOver(texto));
    act(() => result.current.ligacoes!.onDrop(texto));

    expect(result.current.arrastando).toBe(false);
    expect(texto.preventDefault).not.toHaveBeenCalled();
    expect(aoSoltar).not.toHaveBeenCalled();
  });

  it("soltar entrega o primeiro arquivo e apaga a moldura", () => {
    const aoSoltar = jest.fn();
    const { result } = renderHook(() => useArrastarArquivo(aoSoltar));

    act(() => result.current.ligacoes!.onDragEnter(evento(["Files"])));
    const solto = evento(["Files"], [ARQUIVO]);
    act(() => result.current.ligacoes!.onDrop(solto));

    expect(solto.preventDefault).toHaveBeenCalled();
    expect(aoSoltar).toHaveBeenCalledWith(ARQUIVO);
    expect(result.current.arrastando).toBe(false);
  });

  it("sem aoSoltar a região não aceita arquivo", () => {
    const { result } = renderHook(() => useArrastarArquivo(undefined));
    expect(result.current).toEqual({ arrastando: false, ligacoes: undefined });
  });
});
