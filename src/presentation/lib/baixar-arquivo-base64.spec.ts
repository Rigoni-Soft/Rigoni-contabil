import { baixarArquivoBase64 } from "./baixar-arquivo-base64";

const base64DePdf = btoa("pdf");

describe("baixarArquivoBase64", () => {
  const criarUrl = jest.fn(() => "blob:arquivo");
  const revogarUrl = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: revogarUrl });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    criarUrl.mockClear();
    revogarUrl.mockClear();
  });

  it("clica num link com o nome do arquivo e o tira do DOM", () => {
    const noClique: boolean[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      noClique.push(document.body.contains(this));
    });

    baixarArquivoBase64("cartao.pdf", base64DePdf, "application/pdf");

    const clicado = click.mock.contexts[0] as HTMLAnchorElement;
    expect(noClique).toEqual([true]);
    expect(clicado.download).toBe("cartao.pdf");
    expect(clicado.href).toBe("blob:arquivo");
    expect(document.body.querySelector("a")).toBeNull();
  });

  it("monta o Blob com os bytes decodificados e o tipo recebido", () => {
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    baixarArquivoBase64("cartao.pdf", base64DePdf, "application/pdf");

    const [blob] = criarUrl.mock.calls[0] as unknown as [Blob];
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(3);
  });

  it("revoga a URL só depois do clique, não na mesma volta", () => {
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    baixarArquivoBase64("cartao.pdf", base64DePdf, "application/pdf");
    expect(revogarUrl).not.toHaveBeenCalled();

    jest.runAllTimers();
    expect(revogarUrl).toHaveBeenCalledWith("blob:arquivo");
  });
});
